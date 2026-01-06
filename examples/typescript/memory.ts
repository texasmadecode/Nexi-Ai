/**
 * Memory Example - TypeScript
 *
 * This example shows how to use Nexi's memory system.
 * Run with: npx tsx examples/typescript/memory.ts
 */

import { NexiAPI } from '../../src/api/index.js';

async function main() {
  console.log('🤖 Nexi AI - Memory Example\n');

  const nexi = await NexiAPI.create({
    dataDir: './example-data-memory',
    logLevel: 'none',
  });

  // Store different types of memories
  console.log('📝 Storing memories...\n');

  nexi.remember('User prefers dark mode', { type: 'preference', importance: 6 });
  nexi.remember('User works as a software developer', { type: 'fact', importance: 8 });
  nexi.remember('User mentioned they have a cat named Luna', { type: 'fact', importance: 7 });
  nexi.remember('Had a great conversation about TypeScript', { type: 'event', importance: 5 });

  // Search memories
  console.log('🔍 Searching for "developer":');
  const results = nexi.searchMemories('developer');
  for (const memory of results.memories) {
    console.log(`  - [${memory.type}] ${memory.content} (importance: ${memory.importance})`);
  }
  console.log();

  // Get stats
  const stats = nexi.getStats();
  console.log('📊 Memory stats:');
  console.log(`  Total memories: ${stats.memories.total}`);
  console.log(`  By type:`, stats.memories.byType);
  console.log(`  Average importance: ${stats.memories.averageImportance.toFixed(1)}`);
  console.log();

  // Chat - memories will be used in context
  if (await nexi.isAvailable()) {
    console.log('💬 Chat (memories will influence response):');
    console.log('You: Do you remember anything about me?');
    const response = await nexi.chat('Do you remember anything about me?');
    console.log(`Nexi: ${response.message}`);
  }

  nexi.shutdown();
  console.log('\n✨ Done!');
}

main().catch(console.error);
