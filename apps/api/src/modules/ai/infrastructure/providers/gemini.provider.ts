import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider } from './ai-provider.interface';
import {
  AIProviderChatInput,
  AIProviderChatOutput,
  AIToolCall,
  AIToolDefinition,
} from '../../domain/ai.types';

/** Upper bound for a single wait, including one taken from Retry-After. */
const MAX_RETRY_DELAY_MS = 5000;
/** Per-attempt wait for a chat turn. */
const CHAT_TIMEOUT_MS = 30000;
/** Audio stages (speech-to-text, TTS) legitimately take longer than chat. */
const AUDIO_TIMEOUT_MS = 45000;

@Injectable()
export class GeminiProvider implements AIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly ttsModel: string;
  private readonly ttsVoice: string;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ai.geminiApiKey') || '';
    this.ttsModel =
      this.config.get<string>('ai.ttsModel') || 'gemini-2.5-flash-preview-tts';
    this.ttsVoice = this.config.get<string>('ai.ttsVoice') || 'Kore';
    this.model = this.config.get<string>('ai.model') || 'gemini-flash-latest';
    this.maxRetries = this.config.get<number>('ai.retryMaxRetries') ?? 2;
    this.baseDelayMs = this.config.get<number>('ai.retryBaseDelayMs') ?? 400;
  }

  /**
   * POSTs to a Gemini endpoint, retrying only the two transient statuses
   * Google throttles with. Retry-After wins over the exponential backoff when
   * the server sends one. Every other status is handed back untouched so each
   * caller keeps producing its own error message.
   */
  private async post(
    url: string,
    body: unknown,
    timeoutMs = CHAT_TIMEOUT_MS,
  ): Promise<Response> {
    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!this.isTransient(res.status) || attempt >= this.maxRetries) {
        return res;
      }
      attempt += 1;
      const delayMs = this.nextDelayMs(res, attempt);
      this.logger.warn(
        `Gemini ${res.status}; retry ${attempt}/${this.maxRetries} in ${delayMs}ms`,
      );
      // Drop the discarded error body so the connection can be reused.
      void res.body?.cancel().catch(() => undefined);
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  private isTransient(status: number): boolean {
    return status === 429 || status === 503;
  }

  private nextDelayMs(res: Response, attempt: number): number {
    const fromHeader = this.parseRetryAfter(res.headers.get('retry-after'));
    if (fromHeader !== undefined) {
      return fromHeader;
    }
    const backoff = this.baseDelayMs * 2 ** (attempt - 1);
    const jitter = Math.floor(Math.random() * this.baseDelayMs);
    return this.capDelay(backoff + jitter);
  }

  private parseRetryAfter(header: string | null): number | undefined {
    if (!header) return undefined;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) {
      return this.capDelay(seconds * 1000);
    }
    const at = Date.parse(header);
    if (Number.isNaN(at)) return undefined;
    return this.capDelay(at - Date.now());
  }

  private capDelay(ms: number): number {
    if (!Number.isFinite(ms) || ms < 0) return 0;
    return Math.min(ms, MAX_RETRY_DELAY_MS);
  }

  async generateResponse(
    input: AIProviderChatInput,
  ): Promise<AIProviderChatOutput> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(
      this.apiKey,
    )}`;

    // Map history and incoming message to Gemini contents format
    const contents: any[] = [];

    // Gemini rejects replayed functionCall parts that carry no
    // thoughtSignature (HTTP 400: "Function call is missing a
    // thought_signature"). Signatures are unavailable for tool calls minted
    // by a non-Gemini fallback provider or stored before signatures were
    // captured, so those exchanges are dropped from the replayed history
    // together with their functionResponse partner turn.
    let pendingUnsignedExchange = false;

    // Add prior history
    for (const msg of input.history) {
      if (msg.role === 'user') {
        pendingUnsignedExchange = false;
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        pendingUnsignedExchange = false;
        const parts: any[] = [];
        if (msg.content) parts.push({ text: msg.content });
        const toolCalls = msg.toolCalls ?? [];
        const signed =
          toolCalls.length > 0 &&
          toolCalls.every(
            (tc) =>
              typeof tc.thoughtSignature === 'string' && tc.thoughtSignature,
          );
        if (signed) {
          for (const tc of toolCalls) {
            parts.push({
              functionCall: { name: tc.name, args: tc.args },
              thoughtSignature: tc.thoughtSignature,
            });
          }
        } else if (toolCalls.length > 0) {
          pendingUnsignedExchange = true;
        }
        if (parts.length > 0) contents.push({ role: 'model', parts });
      } else if (msg.role === 'tool' && msg.toolResults) {
        if (pendingUnsignedExchange) {
          pendingUnsignedExchange = false;
          continue;
        }
        const parts: any[] = [];
        for (const tr of msg.toolResults) {
          parts.push({
            functionResponse: {
              name: tr.name,
              response: { content: tr.result },
            },
          });
        }
        contents.push({ role: 'user', parts });
      }
    }

    // Add current user message. Omitted on tool-loop turns, where the results
    // are already expressed as the functionResponse turn built above.
    if (input.message) {
      contents.push({
        role: 'user',
        parts: [{ text: input.message }],
      });
    }

    // Format tools if provided
    let toolsPayload: any = undefined;
    if (input.tools && input.tools.length > 0) {
      toolsPayload = [
        {
          functionDeclarations: input.tools.map((t: AIToolDefinition) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    const body: Record<string, unknown> = {
      contents,
      systemInstruction: {
        parts: [{ text: input.systemInstruction }],
      },
    };

    if (toolsPayload) {
      body.tools = toolsPayload;
    }

    try {
      const res = await this.post(url, body);

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`Gemini API error status ${res.status}: ${errText}`);
        throw new Error(`AI Provider API responded with status ${res.status}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let text = '';
      const toolCalls: AIToolCall[] = [];

      for (const part of parts) {
        if (part.text) {
          text += part.text;
        }
        if (part.functionCall) {
          const sig = (part as { thoughtSignature?: unknown }).thoughtSignature;
          toolCalls.push({
            id: 'call_' + Math.random().toString(36).slice(2, 9),
            name: part.functionCall.name,
            args: part.functionCall.args || {},
            thoughtSignature: typeof sig === 'string' ? sig : undefined,
          });
        }
      }

      return {
        text: text.trim() ? text : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (err) {
      this.logger.error(
        `Error in GeminiProvider.generateResponse: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  async transcribeAudio(
    audio: Buffer,
    mimeType: string,
    language?: string,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(
      this.apiKey,
    )}`;

    // AI-019: without an explicit language the model sometimes guesses wrong
    // (observed: Amharic speech transcribed as Latin/Turkish gibberish), so the
    // client's UI language is used as the transcription target when provided.
    const languageHint =
      language === 'am'
        ? 'The speaker is speaking Amharic (አማርኛ). Transcribe it verbatim in Amharic (Ethiopic) script; never transliterate into Latin script.'
        : language === 'en'
          ? 'The speaker is speaking English. Transcribe it verbatim in English.'
          : 'Identify the language being spoken and transcribe it verbatim in that language and script.';

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: audio.toString('base64'),
              },
            },
            {
              text: `${languageHint} Output only the transcription text, nothing else.`,
            },
          ],
        },
      ],
    };

    const res = await this.post(url, body, AUDIO_TIMEOUT_MS);

    if (!res.ok) {
      throw new Error(`Audio transcription failed: status ${res.status}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.ttsModel}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: this.ttsVoice } },
        },
      },
    };
    const response = await this.post(url, body, AUDIO_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(`Gemini TTS failed with status ${response.status}`);
    }
    const data = await response.json();
    const inline = data.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.inlineData?.data,
    )?.inlineData;
    if (!inline?.data) throw new Error('Gemini TTS returned no audio');
    const audio = Buffer.from(inline.data, 'base64');
    const mimeType = String(inline.mimeType || '').toLowerCase();
    // Gemini TTS commonly returns signed 16-bit PCM (audio/L16). Wrap it
    // as a standard WAV so Expo can play it without a native decoder plugin.
    if (mimeType.startsWith('audio/l16')) {
      const rateMatch = mimeType.match(/rate=(\d+)/);
      return this.pcmToWav(audio, Number(rateMatch?.[1] || 24000));
    }
    return audio;
  }

  private pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
  }
}
