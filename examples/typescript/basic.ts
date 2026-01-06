/**
 * Basic Nexi AI Usage - TypeScript
 *
 * This example shows basic usage of the Nexi AI API.
 * Run with: npx tsx examples/typescript/basic.ts
 */

import { NexiAPI } from '../../src/api/index.js';

async function main() {
  console.log('🤖 Nexi AI - Basic Example\n');

  // Create Nexi instance with custom config
  const nexi = await NexiAPI.create({
    model: 'llama3.1:8b',
    dataDir: './example-data',
    logLevel: 'info',
  });

  // Check if Ollama is available
  const available = await nexi.isAvailable();
  if (!available) {
    console.log('❌ Ollama is not running. Please start it with: ollama serve');
    return;
  }

  console.log('✅ Connected to Ollama\n');

  // Simple chat
  console.log('You: Hello!');
  const response1 = await nexi.chat('Hello!');
  console.log(`Nexi: ${response1.message}`);
  console.log(`  (mood: ${response1.mood}, energy: ${response1.energy})\n`);

  // Another message
  console.log('You: What do you like to do for fun?');
  const response2 = await nexi.chat('What do you like to do for fun?');
  console.log(`Nexi: ${response2.message}\n`);

  // Store a memory
  nexi.remember('User is learning to use Nexi AI', { importance: 8 });
  console.log('📝 Stored memory: "User is learning to use Nexi AI"\n');

  // Get stats
  const stats = nexi.getStats();
  console.log('📊 Stats:');
  console.log(`  Mode: ${stats.mode}`);
  console.log(`  Mood: ${stats.mood}`);
  console.log(`  Energy: ${stats.energy}`);
  console.log(`  Interactions: ${stats.interactions}`);
  console.log(`  Memories: ${stats.memories.total}`);

  // Cleanup
  nexi.shutdown();
  console.log('\n✨ Done!');
}

main().catch(console.error);
