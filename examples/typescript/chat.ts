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

let currentCharacter = 'nexi';

function printHelp(): void {
  console.log(`
${color('Commands:', 'bright')}
  ${color('/help', 'cyan')}          - Show this help
  ${color('/characters', 'cyan')}    - List available characters
  ${color('/char <name>', 'cyan')}   - Switch character (e.g., /char pirate)
  ${color('/reset', 'cyan')}         - Reset to default Nexi
  ${color('/mode <m>', 'cyan')}      - Set mode (react, chat, think)
  ${color('/mood', 'cyan')}          - Show current mood
  ${color('/stats', 'cyan')}         - Show stats
  ${color('/remember <text>', 'cyan')} - Store a memory
  ${color('/search <query>', 'cyan')}  - Search memories
  ${color('/clear', 'cyan')}         - Clear conversation history
  ${color('/exit', 'cyan')}          - Exit chat

${color('Characters:', 'bright')}
  nexi       - Default Nexi AI
  assistant  - Helpful assistant
  pirate     - Captain Blackbeard 🏴‍☠️
  wizard     - Gandrix the Wise 🧙
  catgirl    - Miko the catgirl 🐱
  robot      - UNIT-7 sarcastic robot 🤖
  storyteller - The Narrator (D&D style)
  therapist  - Dr. Sage (supportive listener)
`);
}

async function main(): Promise<void> {
  console.log(color('\n╔════════════════════════════════════════╗', 'cyan'));
  console.log(color('║', 'cyan') + color('        🤖 NEXI AI - Terminal Chat       ', 'bright') + color('║', 'cyan'));
  console.log(color('╚════════════════════════════════════════╝', 'cyan'));
  console.log(color('Type /help for commands, /characters to see roleplay options\n', 'dim'));

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

  console.log(color('✓ Connected to Ollama', 'green'));
  console.log(color(`✓ Character: ${currentCharacter}\n`, 'green'));

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const getPromptName = () => {
    const char = NexiAPI.getCharacter(currentCharacter);
    return char?.displayName || 'Nexi';
  };

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

          case 'characters':
          case 'chars':
            const chars = NexiAPI.getCharacters();
            console.log(color('\n🎭 Available Characters:', 'cyan'));
            for (const name of chars) {
              const c = NexiAPI.getCharacter(name);
              if (c) {
                const marker = name === currentCharacter ? ' ← current' : '';
                console.log(`  ${color(name, 'bright')}: ${c.description}${color(marker, 'green')}`);
              }
            }
            console.log();
            break;

          case 'char':
          case 'character':
            if (arg) {
              const char = NexiAPI.getCharacter(arg.toLowerCase());
              if (char) {
                nexi.setCharacter(arg.toLowerCase());
                nexi.clearHistory(); // Clear history when switching characters
                currentCharacter = arg.toLowerCase();
                console.log(color(`\n✓ Switched to: ${char.displayName}`, 'green'));
                console.log(color(`  ${char.description}`, 'dim'));
                if (char.greeting) {
                  console.log(color(`\n${char.displayName}: `, 'cyan') + char.greeting);
                }
                console.log();
              } else {
                console.log(color(`Unknown character: ${arg}. Use /characters to see options.`, 'yellow'));
              }
            } else {
              console.log(color('Usage: /char <character_name>', 'yellow'));
            }
            break;

          case 'reset':
            nexi.resetCharacter();
            nexi.clearHistory();
            currentCharacter = 'nexi';
            console.log(color('✓ Reset to default Nexi', 'green'));
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
            console.log(`  Character: ${currentCharacter}`);
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

          default:
            console.log(color(`Unknown command: /${cmd}. Type /help for commands.`, 'yellow'));
        }

        prompt();
        return;
      }

      // Regular chat - stream response
      process.stdout.write(color(`${getPromptName()}: `, 'cyan'));

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
