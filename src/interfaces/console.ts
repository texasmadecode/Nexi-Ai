#!/usr/bin/env node
// Nexi Console Interface

import * as readline from 'readline';
import chalk from 'chalk';
import { Nexi } from '../core/nexi.js';
import { getModeName } from '../core/modes.js';
import { BehavioralMode } from '../types/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const DATA_DIR = process.env.NEXI_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const nexi = new Nexi({ dataDir: DATA_DIR });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const log = console.log;
const cyan = chalk.cyan, gray = chalk.gray, green = chalk.green, white = chalk.white, yellow = chalk.yellow, red = chalk.red, magenta = chalk.magenta;

function showHeader(): void {
  log(cyan('\n═══════════════════════════════════════════'));
  log(cyan.bold('          NEXI AI - Local Console'));
  log(cyan('═══════════════════════════════════════════'));
  log(gray('Commands: /help, /mode, /stats, /remember, /quit'));
  log(gray('Backend: Ollama (local)\n'));
}

function showState(): void {
  const s = nexi.getState();
  log(gray(`[${getModeName(s.mode)} | Mood: ${s.mood} | Energy: ${s.energy}]`));
}

function showHelp(): void {
  log(yellow('\n📖 Commands:'));
  log(white('  /help      /mode      /react    /chat     /think'));
  log(white('  /stats     /remember  /search   /clear    /save     /quit\n'));
}

function showStats(): void {
  const stats = nexi.getMemoryStats(), s = nexi.getState();
  log(yellow('\n📊 Stats:'));
  log(white(`  Memories: ${stats.total} | Avg importance: ${stats.avgImportance.toFixed(1)}`));
  Object.entries(stats.byType).forEach(([t, c]) => log(gray(`    ${t}: ${c}`)));
  log(white(`  Mood: ${s.mood} | Energy: ${s.energy} | Interactions: ${s.interactionCount}\n`));
}

async function handleCommand(input: string): Promise<boolean> {
  const [cmd, ...rest] = input.trim().split(/\s+/);
  const args = rest.join(' ');

  switch (cmd.toLowerCase()) {
    case '/help': showHelp(); return true;
    case '/mode': log(cyan(`\nMode: ${getModeName(nexi.getState().mode)}\n`)); return true;
    case '/react': case '/chat': case '/think':
      nexi.setMode(cmd.slice(1) as BehavioralMode);
      log(cyan(`\n→ ${getModeName(cmd.slice(1) as BehavioralMode)}\n`));
      return true;
    case '/stats': showStats(); return true;
    case '/remember':
      if (!args) { log(yellow('\nUsage: /remember <text>\n')); return true; }
      nexi.remember(args); log(green(`\n✓ Remembered\n`)); return true;
    case '/search':
      if (!args) { log(yellow('\nUsage: /search <query>\n')); return true; }
      const mems = nexi.searchMemories(args);
      if (!mems.length) log(gray('\nNo memories.\n'));
      else { log(yellow(`\n🔍 ${mems.length} found:`)); mems.forEach((m, i) => log(white(`  ${i + 1}. [${m.type}] ${m.content}`))); log(''); }
      return true;
    case '/clear': nexi.clearConversation(); log(cyan('\n✓ Cleared\n')); return true;
    case '/save':
      log(gray('\nProcessing...'));
      const saved = await nexi.processMemories();
      log(saved.length ? green(`✓ ${saved.length} saved\n`) : gray('Nothing new.\n'));
      return true;
    case '/quit': case '/exit': case '/q': return false;
    default:
      if (input.startsWith('/')) { log(red(`\nUnknown: ${cmd}\n`)); return true; }
      return false;
  }
}

async function chat(input: string): Promise<void> {
  try {
    process.stdout.write(chalk.magenta('\nNexi: '));

    // Stream tokens as they arrive
    await nexi.chat(input, {
      stream: true,
      onToken: (token: string) => {
        process.stdout.write(chalk.white(token));
      },
    });

    console.log('\n');
  } catch (error: any) {
    console.error(chalk.red(`\nError: ${error.message}\n`));
  }
}

async function checkOllama(): Promise<boolean> {
  const available = await nexi.isProviderAvailable();
  if (!available) {
    console.error(chalk.red('\n✗ Cannot connect to Ollama at ' + (process.env.OLLAMA_HOST || 'http://localhost:11434')));
    console.error(chalk.yellow('\nMake sure Ollama is running:'));
    console.error(chalk.white('  1. Install Ollama: https://ollama.ai'));
    console.error(chalk.white('  2. Start Ollama: ollama serve'));
    console.error(chalk.white('  3. Pull a model: ollama pull llama3.1:8b\n'));
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  displayHeader();

  // Check Ollama connection
  if (!(await checkOllama())) {
    process.exit(1);
  }

  console.log(chalk.green('✓ Connected to Ollama\n'));
  displayState();
  console.log('');

  // Initial greeting with streaming
  try {
    process.stdout.write(chalk.magenta('Nexi: '));
    await nexi.chat('*session starts*', {
      stream: true,
      onToken: (token: string) => {
        process.stdout.write(chalk.white(token));
      },
    });
    console.log('\n');
  } catch (error: any) {
    console.log(chalk.gray('(Nexi is waking up...)\n'));
  }

  const prompt = (): void => {
    displayState();
    rl.question(chalk.green('You: '), async (input) => {
      const trimmedInput = input.trim();

      if (!trimmedInput) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmedInput.startsWith('/')) {
        const shouldContinue = await handleCommand(trimmedInput);
        if (!shouldContinue) {
          console.log(chalk.cyan('\nGoodbye! Nexi will remember this conversation.\n'));
          await nexi.processMemories();
          nexi.shutdown();
          rl.close();
          process.exit(0);
        }
        prompt();
        return;
      }

      // Regular chat with streaming
      await chat(trimmedInput);
      prompt();
    });
  };

  prompt();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.cyan('\n\nShutting down gracefully...'));
  await nexi.processMemories();
  nexi.shutdown();
  process.exit(0);
});

// Run
main().catch(console.error);
