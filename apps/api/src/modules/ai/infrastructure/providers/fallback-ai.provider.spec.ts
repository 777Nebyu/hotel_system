import type { AIProviderChatInput } from '../../domain/ai.types';
import type { AIProvider } from './ai-provider.interface';
import { FallbackAIProvider } from './fallback-ai.provider';

const chatInput: AIProviderChatInput = {
  systemInstruction: 'sys',
  history: [],
  message: 'hello',
};

const makeStub = () => {
  const generateResponse = jest.fn().mockResolvedValue({ text: 'ok' });
  const transcribeAudio = jest.fn().mockResolvedValue('transcript');
  const synthesizeSpeech = jest.fn().mockResolvedValue(Buffer.from('wav'));
  const provider: AIProvider = {
    generateResponse,
    transcribeAudio,
    synthesizeSpeech,
  };
  return { provider, generateResponse, transcribeAudio, synthesizeSpeech };
};

describe('FallbackAIProvider (AI-001, AI-023)', () => {
  let primary: ReturnType<typeof makeStub>;
  let fallback: ReturnType<typeof makeStub>;
  let provider: FallbackAIProvider;

  beforeEach(() => {
    primary = makeStub();
    fallback = makeStub();
    provider = new FallbackAIProvider(
      primary.provider,
      fallback.provider,
      'mock',
    );
    jest
      .spyOn(FallbackAIProvider.prototype as any, 'report')
      .mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns the primary result and never touches the fallback', async () => {
    primary.generateResponse.mockResolvedValue({ text: 'primary' });

    const out = await provider.generateResponse(chatInput);

    expect(out.text).toBe('primary');
    expect(fallback.generateResponse).not.toHaveBeenCalled();
    expect(primary.transcribeAudio).not.toHaveBeenCalled();
  });

  it('serves generateResponse from the fallback when the primary fails', async () => {
    primary.generateResponse.mockRejectedValue(new Error('Gemini 503'));
    fallback.generateResponse.mockResolvedValue({ text: 'fallback' });

    const out = await provider.generateResponse(chatInput);

    expect(out.text).toBe('fallback');
    expect(fallback.generateResponse).toHaveBeenCalledWith(chatInput);
  });

  it('serves transcribeAudio and synthesizeSpeech from the fallback when the primary fails', async () => {
    primary.transcribeAudio.mockRejectedValue(new Error('stt down'));
    primary.synthesizeSpeech.mockRejectedValue(new Error('tts down'));
    fallback.transcribeAudio.mockResolvedValue('fallback transcript');
    fallback.synthesizeSpeech.mockResolvedValue(Buffer.from('fallback wav'));

    await expect(
      provider.transcribeAudio(Buffer.from('a'), 'audio/wav', 'en'),
    ).resolves.toBe('fallback transcript');
    await expect(provider.synthesizeSpeech('hi')).resolves.toEqual(
      Buffer.from('fallback wav'),
    );
    expect(fallback.transcribeAudio).toHaveBeenCalledWith(
      Buffer.from('a'),
      'audio/wav',
      'en',
    );
    expect(fallback.synthesizeSpeech).toHaveBeenCalledWith('hi');
  });

  it('keeps a successful tool-call turn on the primary without touching the fallback', async () => {
    primary.generateResponse.mockResolvedValue({
      toolCalls: [{ id: 'call_1', name: 'checkRoomAvailability', args: {} }],
    });

    const out = await provider.generateResponse(chatInput);

    expect(out.toolCalls).toHaveLength(1);
    expect(fallback.generateResponse).not.toHaveBeenCalled();
  });

  it('propagates when both providers fail so AIService can show the AI-023 apology', async () => {
    primary.generateResponse.mockRejectedValue(new Error('primary down'));
    fallback.generateResponse.mockRejectedValue(new Error('fallback down'));
    primary.transcribeAudio.mockRejectedValue(new Error('primary stt down'));
    fallback.transcribeAudio.mockRejectedValue(new Error('fallback stt down'));

    await expect(provider.generateResponse(chatInput)).rejects.toThrow(
      'fallback down',
    );
    await expect(
      provider.transcribeAudio(Buffer.from('a'), 'audio/wav'),
    ).rejects.toThrow('fallback stt down');
  });
});
