/**
 * Streaming Example - TypeScript
 *
 * This example shows how to use streaming responses.
 * Run with: npx tsx examples/typescript/streaming.ts
 */

import { NexiAPI } from '../../src/api/index.js';

async function main() {
  console.log('🤖 Nexi AI - Streaming Example\n');

  const nexi = await NexiAPI.create({
    model: 'llama3.1:8b',
    dataDir: './example-data',
    logLevel: 'none', // Quiet logging for cleaner output
  });

  // Check availability
  if (!(await nexi.isAvailable())) {
    console.log('❌ Ollama is not running');
    return;
  }

  // Set to think mode for a longer response
  nexi.setMode('think');

  console.log('You: Tell me about the history of artificial intelligence.\n');
  console.log('Nexi: ');

  // Stream the response
  const response = await nexi.chatStream(
    'Tell me about the history of artificial intelligence.',
    (token) => {
      process.stdout.write(token);
    }
  );

  console.log('\n');
  console.log(`\n📊 Response stats:`);
  console.log(`  Total length: ${response.message.length} characters`);
  console.log(`  Mood: ${response.mood}`);
  console.log(`  Mode: ${response.mode}`);

  nexi.shutdown();
}

main().catch(console.error);
