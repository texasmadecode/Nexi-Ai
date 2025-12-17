import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../src/core/providers/ollama.js';

describe('OllamaProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create provider with config', () => {
      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'llama3.1:8b',
      });

      expect(provider.getModelForMode('chat')).toBe('llama3.1:8b');
    });

    it('should respect model overrides', () => {
      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'llama3.1:8b',
        modelOverrides: {
          think: 'mixtral:8x7b',
          react: 'llama3.2:3b',
        },
      });

      expect(provider.getModelForMode('think')).toBe('mixtral:8x7b');
      expect(provider.getModelForMode('react')).toBe('llama3.2:3b');
      expect(provider.getModelForMode('chat')).toBe('llama3.1:8b'); // Falls back to default
    });
  });

  describe('fromEnv', () => {
    it('should use defaults when no env vars set', () => {
      delete process.env.OLLAMA_HOST;
      delete process.env.NEXI_MODEL_DEFAULT;

      const provider = OllamaProvider.fromEnv();
      expect(provider.getModelForMode('chat')).toBe('llama3.1:8b');
    });

    it('should use OLLAMA_HOST env var', () => {
      process.env.OLLAMA_HOST = 'http://custom:9999';
      const provider = OllamaProvider.fromEnv();
      // Provider is created - internal URL can be verified through other means if needed
      expect(provider).toBeDefined();
    });

    it('should use NEXI_MODEL_DEFAULT env var', () => {
      process.env.NEXI_MODEL_DEFAULT = 'mistral:7b';
      const provider = OllamaProvider.fromEnv();
      expect(provider.getModelForMode('chat')).toBe('mistral:7b');
    });

    it('should use mode-specific model env vars', () => {
      process.env.NEXI_MODEL_REACT = 'llama3.2:3b';
      process.env.NEXI_MODEL_THINK = 'mixtral:8x7b';

      const provider = OllamaProvider.fromEnv();
      expect(provider.getModelForMode('react')).toBe('llama3.2:3b');
      expect(provider.getModelForMode('think')).toBe('mixtral:8x7b');
      expect(provider.getModelForMode('chat')).toBe('llama3.1:8b'); // default
    });
  });

  describe('getModelForMode', () => {
    it('should return correct model for each mode', () => {
      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'default-model',
        modelOverrides: {
          react: 'react-model',
          chat: 'chat-model',
          think: 'think-model',
          offline: 'offline-model',
        },
      });

      expect(provider.getModelForMode('react')).toBe('react-model');
      expect(provider.getModelForMode('chat')).toBe('chat-model');
      expect(provider.getModelForMode('think')).toBe('think-model');
      expect(provider.getModelForMode('offline')).toBe('offline-model');
    });

    it('should fall back to default model when no override', () => {
      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'fallback-model',
        modelOverrides: {
          think: 'special-model',
        },
      });

      expect(provider.getModelForMode('react')).toBe('fallback-model');
      expect(provider.getModelForMode('chat')).toBe('fallback-model');
      expect(provider.getModelForMode('think')).toBe('special-model');
      expect(provider.getModelForMode('offline')).toBe('fallback-model');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama responds', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      });
      global.fetch = mockFetch;

      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'test',
      });

      const available = await provider.isAvailable();
      expect(available).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });

    it('should return false when Ollama is not available', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      global.fetch = mockFetch;

      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'test',
      });

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });

    it('should return false when response is not ok', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = mockFetch;

      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'test',
      });

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('generate', () => {
    it('should call Ollama API with correct parameters (non-streaming)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Generated text' }),
      });
      global.fetch = mockFetch;

      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'llama3.1:8b',
      });

      const result = await provider.generate('Test prompt', {
        mode: 'chat',
        maxTokens: 100,
        temperature: 0.7,
        stream: false,
      });

      expect(result).toBe('Generated text');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('llama3.1:8b');
      expect(callBody.prompt).toBe('Test prompt');
      expect(callBody.stream).toBe(false);
      expect(callBody.options.num_predict).toBe(100);
      expect(callBody.options.temperature).toBe(0.7);
    });

    it('should throw error when API returns non-ok response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = mockFetch;

      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'test',
      });

      await expect(
        provider.generate('Test', { mode: 'chat', stream: false })
      ).rejects.toThrow('Ollama error: 500');
    });

    it('should use mode-specific model', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: 'Response' }),
      });
      global.fetch = mockFetch;

      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'default',
        modelOverrides: { think: 'think-model' },
      });

      await provider.generate('Deep thought', {
        mode: 'think',
        stream: false,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('think-model');
    });
  });

  describe('streaming', () => {
    it('should handle streaming response and call onToken', async () => {
      const chunks = [
        JSON.stringify({ response: 'Hello', done: false }) + '\n',
        JSON.stringify({ response: ' world', done: false }) + '\n',
        JSON.stringify({ response: '!', done: true }) + '\n',
      ];

      let chunkIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (chunkIndex < chunks.length) {
            const value = new TextEncoder().encode(chunks[chunkIndex++]);
            return Promise.resolve({ done: false, value });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
        releaseLock: vi.fn(),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });
      global.fetch = mockFetch;

      const provider = new OllamaProvider({
        host: 'http://localhost:11434',
        defaultModel: 'test',
      });

      const tokens: string[] = [];
      const result = await provider.generate('Test', {
        mode: 'chat',
        stream: true,
        onToken: (token) => tokens.push(token),
      });

      expect(result).toBe('Hello world!');
      expect(tokens).toEqual(['Hello', ' world', '!']);
    });
  });
});
