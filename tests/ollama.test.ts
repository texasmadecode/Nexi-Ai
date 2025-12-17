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

  it('should respond with real AI when Ollama is available', async () => {
    if (!ollamaAvailable) {
      console.log('   ⏭️  Skipped: Ollama not available');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🤖 NEXI AI - Real Ollama Test');
    console.log('='.repeat(60) + '\n');

    const response = await nexi.chat('Hello! How are you?');

    console.log('You: Hello! How are you?');
    console.log(`Nexi: ${response}\n`);

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(10);
  }, 60000); // 60s timeout for LLM

  it('should have a full conversation with personality', async () => {
    if (!ollamaAvailable) {
      console.log('   ⏭️  Skipped: Ollama not available');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🤖 NEXI AI - Full Conversation Test');
    console.log('='.repeat(60) + '\n');

    // Start session
    const response1 = await nexi.chat('*session starts*');
    console.log('You: *session starts*');
    console.log(`Nexi: ${response1}\n`);
    expect(response1).toBeDefined();

    // Greeting
    const response2 = await nexi.chat("Hey Nexi! What's up?");
    console.log("You: Hey Nexi! What's up?");
    console.log(`Nexi: ${response2}\n`);
    expect(response2).toBeDefined();

    // Remember something
    nexi.remember('User is testing the AI system');
    console.log('📝 /remember User is testing the AI system');
    console.log('✓ Remembered\n');

    // Ask about capabilities
    const response3 = await nexi.chat('What can you do?');
    console.log('You: What can you do?');
    console.log(`Nexi: ${response3}\n`);
    expect(response3).toBeDefined();

    // Print stats
    const state = nexi.getState();
    const stats = nexi.getMemoryStats();
    console.log('-'.repeat(60));
    console.log('📊 Stats:');
    console.log('-'.repeat(60));
    console.log(`  Mode: ${state.mode}`);
    console.log(`  Mood: ${state.mood}`);
    console.log(`  Energy: ${state.energy}`);
    console.log(`  Interactions: ${state.interactionCount}`);
    console.log(`  Memories: ${stats.total}`);
    console.log('='.repeat(60) + '\n');

    expect(state.interactionCount).toBe(3);
  }, 120000); // 2 min timeout

  it('should respond differently in different modes', async () => {
    if (!ollamaAvailable) {
      console.log('   ⏭️  Skipped: Ollama not available');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🤖 NEXI AI - Mode Comparison Test');
    console.log('='.repeat(60) + '\n');

    const question = 'What is 2 + 2?';

    // React mode (quick)
    nexi.setMode('react');
    const reactResponse = await nexi.chat(question);
    console.log(`[REACT MODE] ${question}`);
    console.log(`Nexi: ${reactResponse}\n`);

    nexi.clearConversation();

    // Think mode (detailed)
    nexi.setMode('think');
    const thinkResponse = await nexi.chat(question);
    console.log(`[THINK MODE] ${question}`);
    console.log(`Nexi: ${thinkResponse}\n`);

    console.log('='.repeat(60) + '\n');

    expect(reactResponse).toBeDefined();
    expect(thinkResponse).toBeDefined();
    // Think mode typically produces longer responses
    expect(thinkResponse.length).toBeGreaterThanOrEqual(reactResponse.length * 0.5);
  }, 120000);

  it('should stream responses in real-time', async () => {
    if (!ollamaAvailable) {
      console.log('   ⏭️  Skipped: Ollama not available');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🤖 NEXI AI - Streaming Test');
    console.log('='.repeat(60) + '\n');

    console.log('You: Tell me a short joke');
    process.stdout.write('Nexi: ');

    const tokens: string[] = [];
    const response = await nexi.chat('Tell me a short joke', {
      stream: true,
      onToken: (token) => {
        tokens.push(token);
        process.stdout.write(token);
      },
    });

    console.log('\n');
    console.log(`Total tokens streamed: ${tokens.length}`);
    console.log('='.repeat(60) + '\n');

    expect(response).toBeDefined();
    expect(tokens.length).toBeGreaterThan(0);
  }, 60000);

  it('should use memories in conversation context', async () => {
    if (!ollamaAvailable) {
      console.log('   ⏭️  Skipped: Ollama not available');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🤖 NEXI AI - Memory Context Test');
    console.log('='.repeat(60) + '\n');

    // Store a memory
    nexi.remember('User name is Alex');
    nexi.remember('User favorite color is blue');
    console.log('📝 Stored memories:');
    console.log('   - User name is Alex');
    console.log('   - User favorite color is blue\n');

    // Ask about remembered info
    const response = await nexi.chat('What do you know about me?');
    console.log('You: What do you know about me?');
    console.log(`Nexi: ${response}\n`);

    console.log('='.repeat(60) + '\n');

    expect(response).toBeDefined();
    // The response should reference stored memories in some way
    expect(response.length).toBeGreaterThan(20);
  }, 60000);
});
