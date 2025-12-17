import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Nexi } from '../src/core/nexi.js';
import { LLMProvider, GenerateOptions } from '../src/core/providers/llm.js';
import fs from 'fs';
import path from 'path';

/**
 * Mock LLM Provider for testing without Ollama
 */
class MockLLMProvider implements LLMProvider {
  private callCount = 0;
  private responses: string[] = [
    'Hello there! Nice to meet you.',
    "I'm doing great, thanks for asking! How about you?",
    "That's interesting! I love learning new things about people.",
    '*stretches* Oh hey! Good to see you.',
    'Hmm, let me think about that... I find conversations like this really enjoyable!',
  ];

  async generate(prompt: string, opts: GenerateOptions): Promise<string> {
    // Simulate some latency
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Check for session start pattern first
    if (prompt.includes('*session starts*')) {
      return this.responses[3]; // stretches response
    }

    // Return varied responses based on call count
    const response = this.responses[this.callCount % this.responses.length];
    this.callCount++;

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

  resetCallCount(): void {
    this.callCount = 0;
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
    });

    it('should respond to session start', async () => {
      mockProvider.resetCallCount();
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
      expect(tokens.join('').trim()).toBe(response);
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

  it('should handle a typical conversation flow and print results', async () => {
    console.log('\n' + '='.repeat(50));
    console.log('🤖 NEXI AI - Integration Test Conversation');
    console.log('='.repeat(50) + '\n');

    // First message
    const response1 = await nexi.chat('Hello!');
    console.log('You: Hello!');
    console.log(`Nexi: ${response1}\n`);
    expect(response1).toBeDefined();
    expect(response1.length).toBeGreaterThan(0);

    // Second message
    const response2 = await nexi.chat('How are you today?');
    console.log('You: How are you today?');
    console.log(`Nexi: ${response2}\n`);
    expect(response2).toBeDefined();

    // Remember something
    nexi.remember('User is working on a TypeScript project');
    console.log('📝 /remember User is working on a TypeScript project');
    console.log('✓ Remembered\n');

    // Third message
    const response3 = await nexi.chat('Tell me something');
    console.log('You: Tell me something');
    console.log(`Nexi: ${response3}\n`);
    expect(response3).toBeDefined();

    // Print conversation history
    console.log('-'.repeat(50));
    console.log('📜 Conversation History:');
    console.log('-'.repeat(50));
    const history = nexi.getConversationHistory();
    history.forEach((msg, i) => {
      const role = msg.role === 'user' ? 'You' : 'Nexi';
      console.log(`  ${i + 1}. [${role}] ${msg.content}`);
    });
    console.log();

    // Print stats
    const state = nexi.getState();
    const stats = nexi.getMemoryStats();
    console.log('-'.repeat(50));
    console.log('📊 /stats');
    console.log('-'.repeat(50));
    console.log(`  Mode: ${state.mode}`);
    console.log(`  Mood: ${state.mood}`);
    console.log(`  Energy: ${state.energy}`);
    console.log(`  Interactions: ${state.interactionCount}`);
    console.log(`  Memories: ${stats.total}`);
    console.log(`  Avg Importance: ${stats.avgImportance.toFixed(1)}`);
    if (Object.keys(stats.byType).length > 0) {
      console.log('  By Type:');
      Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}`);
      });
    }
    console.log('\n' + '='.repeat(50) + '\n');

    // Assertions
    expect(state.interactionCount).toBe(3);
    expect(history.length).toBe(6);

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
