// Nexi AI - Main Entry Point

export { Nexi, ChatOptions } from './core/nexi.js';
export { StateManager } from './core/state.js';
export { MemoryStore } from './memory/store.js';
export { buildSystemPrompt, buildMemoryExtractionPrompt } from './core/prompt.js';
export { detectMode, getModeConfig, getModeName, parseModeCommand } from './core/modes.js';
export { LLMProvider, LLMProviderConfig, GenerateOptions } from './core/providers/llm.js';
export { OllamaProvider } from './core/providers/ollama.js';
export * from './types/index.js';

// Quick start helper
import { Nexi } from './core/nexi.js';
import { OllamaProvider } from './core/providers/ollama.js';
import { LLMProvider } from './core/providers/llm.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create a new Nexi instance with default configuration (Ollama backend)
 */
export function createNexi(options?: {
  dataDir?: string;
  provider?: LLMProvider;
}): Nexi {
  dotenv.config();

  const provider = options?.provider ?? OllamaProvider.fromEnv();

  return new Nexi(
    {
      dataDir: options?.dataDir || process.env.NEXI_DATA_DIR || path.join(__dirname, '../data'),
    },
    provider
  );
}
