#!/usr/bin/env npx tsx
/**
 * Nexi AI - Terminal Chat
 *
 * A simple interactive chat interface for Nexi AI.
 * Run with: npx tsx examples/typescript/chat.ts
 */

import * as readline from 'readline';
import { NexiAPI } from '../../src/api/index.js';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`;
}

function printHelp(): void {
  console.log(`
${color('Commands:', 'bright')}
  ${color('/help', 'cyan')}        - Show this help
  ${color('/mode <m>', 'cyan')}    - Set mode (react, chat, think)
  ${color('/mood', 'cyan')}        - Show current mood
  ${color('/stats', 'cyan')}       - Show stats
  ${color('/remember <text>', 'cyan')} - Store a memory
  ${color('/search <query>', 'cyan')}  - Search memories
  ${color('/clear', 'cyan')}       - Clear conversation history
  ${color('/personality <p>', 'cyan')} - Set personality preset
  ${color('/presets', 'cyan')}     - List personality presets
  ${color('/exit', 'cyan')}        - Exit chat
`);
}

async function main(): Promise<void> {
  console.log(color('\n╔════════════════════════════════════════╗', 'cyan'));
  console.log(color('║', 'cyan') + color('        🤖 NEXI AI - Terminal Chat       ', 'bright') + color('║', 'cyan'));
  console.log(color('╚════════════════════════════════════════╝', 'cyan'));
  console.log(color('Type /help for commands, /exit to quit\n', 'dim'));

  // Create Nexi instance
  const nexi = await NexiAPI.create({
    dataDir: './nexi-chat-data',
    logLevel: 'none',
  });

  // Check if Ollama is available
  const available = await nexi.isAvailable();
  if (!available) {
    console.log(color('❌ Ollama is not running!', 'red'));
    console.log(color('   Start it with: ollama serve', 'dim'));
    process.exit(1);
  }

  console.log(color('✓ Connected to Ollama\n', 'green'));

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    rl.question(color('You: ', 'green'), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        const [cmd, ...args] = trimmed.slice(1).split(' ');
        const arg = args.join(' ');

        switch (cmd.toLowerCase()) {
          case 'exit':
          case 'quit':
          case 'q':
            console.log(color('\n👋 Goodbye!\n', 'cyan'));
            nexi.shutdown();
            rl.close();
            process.exit(0);
            break;

          case 'help':
          case 'h':
            printHelp();
            break;

          case 'mode':
            if (['react', 'chat', 'think'].includes(arg)) {
              nexi.setMode(arg as 'react' | 'chat' | 'think');
              console.log(color(`✓ Mode set to: ${arg}`, 'green'));
            } else {
              console.log(color('Usage: /mode <react|chat|think>', 'yellow'));
            }
            break;

          case 'mood':
            const state = nexi.getState();
            console.log(color(`Mood: ${state.mood} | Energy: ${state.energy}`, 'magenta'));
            break;

          case 'stats':
            const stats = nexi.getStats();
            console.log(color('\n📊 Stats:', 'cyan'));
            console.log(`  Mode: ${stats.mode}`);
            console.log(`  Mood: ${stats.mood}`);
            console.log(`  Energy: ${stats.energy}`);
            console.log(`  Interactions: ${stats.interactions}`);
            console.log(`  Memories: ${stats.memories.total}`);
            if (stats.memories.total > 0) {
              console.log(`  Avg Importance: ${stats.memories.averageImportance.toFixed(1)}`);
            }
            console.log();
            break;

          case 'remember':
            if (arg) {
              nexi.remember(arg);
              console.log(color(`✓ Remembered: "${arg}"`, 'green'));
            } else {
              console.log(color('Usage: /remember <text to remember>', 'yellow'));
            }
            break;

          case 'search':
            if (arg) {
              const results = nexi.searchMemories(arg);
              if (results.count > 0) {
                console.log(color(`\n🔍 Found ${results.count} memories:`, 'cyan'));
                for (const m of results.memories) {
                  console.log(`  - [${m.type}] ${m.content}`);
                }
                console.log();
              } else {
                console.log(color('No memories found.', 'dim'));
              }
            } else {
              console.log(color('Usage: /search <query>', 'yellow'));
            }
            break;

          case 'clear':
            nexi.clearHistory();
            console.log(color('✓ Conversation cleared', 'green'));
            break;

          case 'personality':
            if (arg) {
              nexi.setPersonality(arg);
              console.log(color(`✓ Personality set to: ${arg}`, 'green'));
            } else {
              console.log(color('Usage: /personality <preset>', 'yellow'));
            }
            break;

          case 'presets':
            const presets = NexiAPI.getPresets();
            console.log(color('\nAvailable presets:', 'cyan'));
            console.log(`  ${presets.join(', ')}\n`);
            break;

          default:
            console.log(color(`Unknown command: /${cmd}. Type /help for commands.`, 'yellow'));
        }

        prompt();
        return;
      }

      // Regular chat - stream response
      process.stdout.write(color('Nexi: ', 'cyan'));

      try {
        await nexi.chatStream(trimmed, (token) => {
          process.stdout.write(token);
        });
        console.log('\n');
      } catch (err) {
        console.log(color(`\n❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'red'));
      }

      prompt();
    });
  };

  // Start the prompt loop
  prompt();
}

main().catch((err) => {
  console.error(color(`Fatal error: ${err.message}`, 'red'));
  process.exit(1);
});
