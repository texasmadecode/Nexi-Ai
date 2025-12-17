import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Nexi } from '../src/core/nexi.js';
import { OllamaProvider } from '../src/core/providers/ollama.js';
import fs from 'fs';
import path from 'path';

/**
 * Ollama Integration Tests
 *
 * These tests use the real Ollama LLM to test Nexi's actual AI responses.
 * They are skipped in CI but can be run locally with: npm run test:ollama
 *
 * Requirements:
 * - Ollama running locally (http://localhost:11434)
 * - A model pulled (e.g., llama3.1:8b or mistral)
 */

// Check if Ollama is available
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    return res.ok;
  } catch {
    return false;
  }
}

describe('Nexi with Ollama (Real LLM)', () => {
  const testDataDir = path.join(process.cwd(), 'test-ollama-' + Date.now());
  let nexi: Nexi;
  let provider: OllamaProvider;
  let ollamaAvailable = false;

  beforeAll(async () => {
    ollamaAvailable = await isOllamaAvailable();
    if (!ollamaAvailable) {
      console.log('\n⚠️  Ollama not available - skipping real LLM tests');
      console.log('   To run these tests, start Ollama: ollama serve\n');
    }
  });

  beforeEach(() => {
    if (!ollamaAvailable) return;
    provider = OllamaProvider.fromEnv();
    nexi = new Nexi({ dataDir: testDataDir }, provider);
  });

  afterEach(() => {
    if (!ollamaAvailable) return;
    nexi?.shutdown();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup any leftover test directories
    const dirs = fs.readdirSync(process.cwd()).filter((d) => d.startsWith('test-ollama-'));
    for (const dir of dirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true });
      }
    }
  });

  // Single comprehensive test to minimize LLM calls in CI
  it('should have a conversation with real AI responses', async () => {
    if (!ollamaAvailable) {
      console.log('   ⏭️  Skipped: Ollama not available');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🤖 NEXI AI - Real Ollama Integration Test');
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();

    // Test 1: Basic greeting
    console.log('📝 Test 1: Basic Response');
    const response1 = await nexi.chat('Hi! Say hello in one sentence.');
    console.log(`You: Hi! Say hello in one sentence.`);
    console.log(`Nexi: ${response1}\n`);
    expect(response1).toBeDefined();
    expect(response1.length).toBeGreaterThan(5);

    // Test 2: Memory system
    console.log('📝 Test 2: Memory Storage');
    nexi.remember('User is testing Nexi');
    const memories = nexi.searchMemories('testing');
    console.log(`Stored memory: "User is testing Nexi"`);
    console.log(`Memory search found: ${memories.length} result(s)\n`);
    expect(memories.length).toBeGreaterThan(0);

    // Test 3: Streaming
    console.log('📝 Test 3: Streaming Response');
    const tokens: string[] = [];
    process.stdout.write('Nexi (streaming): ');
    const response2 = await nexi.chat('Say "test complete" in one sentence.', {
      stream: true,
      onToken: (token) => {
        tokens.push(token);
        process.stdout.write(token);
      },
    });
    console.log('\n');
    expect(tokens.length).toBeGreaterThan(0);
    expect(response2).toBeDefined();

    // Print summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const state = nexi.getState();
    const stats = nexi.getMemoryStats();

    console.log('-'.repeat(60));
    console.log('📊 Test Summary:');
    console.log('-'.repeat(60));
    console.log(`  Time elapsed: ${elapsed}s`);
    console.log(`  Interactions: ${state.interactionCount}`);
    console.log(`  Tokens streamed: ${tokens.length}`);
    console.log(`  Memories stored: ${stats.total}`);
    console.log(`  Mode: ${state.mode}`);
    console.log(`  Mood: ${state.mood}`);
    console.log('='.repeat(60) + '\n');

    expect(state.interactionCount).toBe(2);
  }, 180000); // 3 min timeout for slow CI
});
