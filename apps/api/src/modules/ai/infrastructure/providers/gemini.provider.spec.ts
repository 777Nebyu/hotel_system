import { ConfigService } from '@nestjs/config';
import type { AIMessage, AIProviderChatInput } from '../../domain/ai.types';
import { GeminiProvider } from './gemini.provider';

type ProviderOverrides = Partial<{
  retryMaxRetries: number;
  retryBaseDelayMs: number;
}>;

const makeProvider = (overrides: ProviderOverrides = {}): GeminiProvider =>
  new GeminiProvider(
    new ConfigService({
      ai: {
        geminiApiKey: 'test-key',
        model: 'gemini-flash-latest',
        ttsModel: 'gemini-2.5-flash-preview-tts',
        ttsVoice: 'Kore',
        retryMaxRetries: 2,
        retryBaseDelayMs: 0,
        ...overrides,
      },
    }),
  );

const httpResponse = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response => new Response(JSON.stringify(body), { status, headers });

const throttled = (status: number, retryAfter = '0'): Response =>
  httpResponse({}, status, { 'retry-after': retryAfter });

const chatReply = {
  candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
};

const chatInput: AIProviderChatInput = {
  systemInstruction: 'You are helpful.',
  history: [],
  message: 'hi',
};

describe('GeminiProvider retry behaviour', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries a throttled chat request and returns the next success', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(throttled(429))
      .mockResolvedValueOnce(httpResponse(chatReply));

    const out = await makeProvider().generateResponse(chatInput);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(out.text).toBe('Hello');
  });

  it('stops after the configured number of retries', async () => {
    // A fresh Response per attempt, as a real server would send.
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(throttled(429)));

    await expect(makeProvider().generateResponse(chatInput)).rejects.toThrow(
      'AI Provider API responded with status 429',
    );

    // One initial attempt plus retryMaxRetries = 2 more.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('can be configured to never retry', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(throttled(429));

    await expect(
      makeProvider({ retryMaxRetries: 0 }).generateResponse(chatInput),
    ).rejects.toThrow('AI Provider API responded with status 429');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry statuses that are not transient', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(httpResponse({}, 400));

    await expect(makeProvider().generateResponse(chatInput)).rejects.toThrow(
      'AI Provider API responded with status 400',
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('honours Retry-After instead of the configured backoff seed', async () => {
    // The seed is five seconds, so this only finishes quickly if the header
    // wins; ignoring it would make the assertion below fail.
    const provider = makeProvider({ retryBaseDelayMs: 5000 });
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(throttled(429, '0'))
      .mockResolvedValueOnce(httpResponse(chatReply));

    const startedAt = Date.now();
    await provider.generateResponse(chatInput);
    const elapsedMs = Date.now() - startedAt;

    expect(elapsedMs).toBeLessThan(3000);
  });

  it('retries the speech synthesis path too', async () => {
    const pcm = Buffer.alloc(8, 1);
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(throttled(503))
      .mockResolvedValueOnce(
        httpResponse({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'audio/l16;rate=24000',
                      data: pcm.toString('base64'),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );

    const audio = await makeProvider().synthesizeSpeech('hello');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(audio.subarray(0, 4).toString('ascii')).toBe('RIFF');
  });
});

describe('GeminiProvider history replay', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const toolHistory: AIMessage[] = [
    { role: 'user', content: 'check availability' },
    {
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: 'call_1',
          name: 'checkRoomAvailability',
          args: { date: '2026-09-28' },
          thoughtSignature: 'sig-abc',
        },
      ],
    },
    {
      role: 'tool',
      content: '[]',
      toolResults: [
        { toolCallId: 'call_1', name: 'checkRoomAvailability', result: [] },
      ],
    },
  ];

  const sentContents = (fetchSpy: jest.SpyInstance): string => {
    const calls = fetchSpy.mock.calls as unknown as [unknown, RequestInit][];
    const init = calls[0][1];
    const body = JSON.parse(init.body as string) as { contents: unknown };
    return JSON.stringify(body.contents);
  };

  it('replays signed tool exchanges with the thought signature echoed back', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(httpResponse(chatReply));

    await makeProvider().generateResponse({
      systemInstruction: 'You are helpful.',
      history: toolHistory,
      message: '',
    });

    const contents = sentContents(fetchSpy);
    expect(contents).toContain('thoughtSignature');
    expect(contents).toContain('functionResponse');
    expect(contents).toContain('checkRoomAvailability');
  });

  it('drops unsigned tool exchanges instead of replaying a 400-triggering functionCall', async () => {
    const unsigned = JSON.parse(JSON.stringify(toolHistory)) as AIMessage[];
    delete unsigned[1].toolCalls?.[0]?.thoughtSignature;

    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(httpResponse(chatReply));

    await makeProvider().generateResponse({
      systemInstruction: 'You are helpful.',
      history: unsigned,
      message: 'and for tomorrow?',
    });

    const contents = sentContents(fetchSpy);
    expect(contents).not.toContain('functionCall');
    expect(contents).not.toContain('functionResponse');
    expect(contents).toContain('and for tomorrow?');
  });

  it('keeps the text answer when only the tool exchange is unsigned', async () => {
    const mixed = JSON.parse(
      JSON.stringify([
        ...toolHistory,
        { role: 'assistant', content: 'Three rooms left.' },
      ]),
    ) as AIMessage[];
    delete mixed[1].toolCalls?.[0]?.thoughtSignature;

    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(httpResponse(chatReply));

    await makeProvider().generateResponse({
      systemInstruction: 'You are helpful.',
      history: mixed,
      message: 'thanks',
    });

    const contents = sentContents(fetchSpy);
    expect(contents).not.toContain('functionCall');
    expect(contents).toContain('Three rooms left.');
  });
});

describe('GeminiProvider request timeouts', () => {
  const abortingFetch = (): jest.SpyInstance =>
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('This operation was aborted')),
          );
        }),
    );

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('gives chat turns 30s before aborting', async () => {
    abortingFetch();
    let aborted = false;
    const pending = makeProvider()
      .generateResponse(chatInput)
      .catch(() => {
        aborted = true;
      });

    await jest.advanceTimersByTimeAsync(29000);
    expect(aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(1001);
    await pending;
    expect(aborted).toBe(true);
  });

  it('gives audio stages 45s before aborting', async () => {
    abortingFetch();
    let aborted = false;
    const pending = makeProvider()
      .synthesizeSpeech('hello')
      .catch(() => {
        aborted = true;
      });

    await jest.advanceTimersByTimeAsync(30000);
    expect(aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(15001);
    await pending;
    expect(aborted).toBe(true);
  });
});
