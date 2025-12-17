import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Nexi } from '../src/core/nexi.js';
import { LLMProvider, GenerateOptions } from '../src/core/providers/llm.js';
import fs from 'fs';
import path from 'path';

/**
 * Mock LLM Provider for testing without Ollama
 */
class MockLLMProvider implements LLMProvider {
  private responses: Map<string, string> = new Map();

  constructor() {
    // Set up default responses
    this.responses.set('default', "Hey! I'm doing well, thanks for asking.");
    this.responses.set('greeting', 'Hello there! Nice to meet you.');
    this.responses.set('session', '*stretches* Oh hey! Good to see you.');
  }

  async generate(prompt: string, opts: GenerateOptions): Promise<string> {
    // Simulate some latency
    await new Promise((resolve) => setTimeout(resolve, 10));

    let response = this.responses.get('default')!;

    // Check for specific patterns in prompt
    if (prompt.includes('*session starts*')) {
      response = this.responses.get('session')!;
    } else if (prompt.toLowerCase().includes('hello') || prompt.toLowerCase().includes('hi')) {
      response = this.responses.get('greeting')!;
    }

    // Handle streaming
    if (opts.stream && opts.onToken) {
      const words = response.split(' ');
      for (const word of words) {
        opts.onToken(word + ' ');
      }
    }

    return response;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getModelForMode(): string {
    return 'mock-model';
  }

  setResponse(key: string, response: string): void {
    this.responses.set(key, response);
  }
}

describe('Nexi Integration', () => {
  const testDataDir = path.join(process.cwd(), 'test-integration-' + Date.now());
  let nexi: Nexi;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    nexi = new Nexi({ dataDir: testDataDir }, mockProvider);
  });

  afterEach(() => {
    nexi.shutdown();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  describe('basic conversation', () => {
    it('should respond to a simple greeting', async () => {
      const response = await nexi.chat('Hello!');

      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(0);
      expect(response).toContain('Hello');
    });

    it('should respond to session start', async () => {
      const response = await nexi.chat('*session starts*');

      expect(response).toBeDefined();
      expect(response).toContain('stretches');
    });

    it('should maintain conversation history', async () => {
      await nexi.chat('Hello!');
      await nexi.chat('How are you?');

      const history = nexi.getConversationHistory();
      expect(history.length).toBe(4); // 2 user + 2 assistant messages
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Hello!');
      expect(history[1].role).toBe('assistant');
    });

    it('should support streaming responses', async () => {
      const tokens: string[] = [];

      const response = await nexi.chat('Hello!', {
        stream: true,
        onToken: (token) => tokens.push(token),
      });

      expect(response).toBeDefined();
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.join('')).toContain('Hello');
    });
  });

  describe('state management', () => {
    it('should update state after interactions', async () => {
      const initialState = nexi.getState();
      expect(initialState.interactionCount).toBe(0);

      await nexi.chat('Hello!');

      const afterState = nexi.getState();
      expect(afterState.interactionCount).toBe(1);
      expect(afterState.lastInteraction).not.toBeNull();
    });

    it('should allow mode changes', async () => {
      nexi.setMode('think');
      expect(nexi.getState().mode).toBe('think');

      nexi.setMode('react');
      expect(nexi.getState().mode).toBe('react');
    });
  });

  describe('memory system', () => {
    it('should remember explicit requests', () => {
      const memory = nexi.remember('User likes dark mode');

      expect(memory.id).toBeDefined();
      expect(memory.content).toBe('User likes dark mode');
      expect(memory.type).toBe('request');
    });

    it('should search memories', () => {
      nexi.remember('User prefers TypeScript');
      nexi.remember('User works on AI projects');

      const results = nexi.searchMemories('TypeScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.content.includes('TypeScript'))).toBe(true);
    });

    it('should track memory stats', () => {
      nexi.remember('Memory 1');
      nexi.remember('Memory 2');

      const stats = nexi.getMemoryStats();
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('conversation management', () => {
    it('should clear conversation history', async () => {
      await nexi.chat('Hello!');
      expect(nexi.getConversationHistory().length).toBe(2);

      nexi.clearConversation();
      expect(nexi.getConversationHistory().length).toBe(0);
    });
  });

  describe('provider availability', () => {
    it('should report provider as available', async () => {
      const available = await nexi.isProviderAvailable();
      expect(available).toBe(true);
    });
  });
});

describe('Nexi with real-like scenarios', () => {
  const testDataDir = path.join(process.cwd(), 'test-scenarios-' + Date.now());
  let nexi: Nexi;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    nexi = new Nexi({ dataDir: testDataDir }, mockProvider);
  });

  afterEach(() => {
    nexi.shutdown();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  it('should handle a typical conversation flow', async () => {
    // First message
    const response1 = await nexi.chat('Hello!');
    expect(response1).toBeDefined();
    expect(response1.length).toBeGreaterThan(0);

    // Second message
    const response2 = await nexi.chat('How are you today?');
    expect(response2).toBeDefined();

    // Remember something
    nexi.remember('User is working on a TypeScript project');

    // Third message
    const response3 = await nexi.chat('Tell me something');
    expect(response3).toBeDefined();

    // Check state - should have 3 interactions
    const state = nexi.getState();
    expect(state.interactionCount).toBe(3);

    // Check conversation history - 3 user + 3 assistant = 6
    const history = nexi.getConversationHistory();
    expect(history.length).toBe(6);

    // Check memories
    const memories = nexi.searchMemories('TypeScript');
    expect(memories.length).toBeGreaterThan(0);
  });

  it('should persist state across shutdown', async () => {
    await nexi.chat('Hello!');
    nexi.setMode('think');
    nexi.remember('Important note');

    const stateBefore = nexi.getState();
    nexi.shutdown();

    // Create new instance with same data dir
    const nexi2 = new Nexi({ dataDir: testDataDir }, mockProvider);

    const stateAfter = nexi2.getState();
    expect(stateAfter.mode).toBe('think');
    expect(stateAfter.interactionCount).toBe(stateBefore.interactionCount);

    // Memory should persist
    const memories = nexi2.searchMemories('Important');
    expect(memories.length).toBeGreaterThan(0);

    nexi2.shutdown();

    // Reassign nexi so afterEach doesn't fail
    nexi = new Nexi({ dataDir: testDataDir }, mockProvider);
  });
});
