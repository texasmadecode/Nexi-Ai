// Nexi AI - Main Entry Point

// Simple API (recommended for most users)
export {
  NexiAPI,
  createNexi as create,
  quickChat,
  NexiAPIConfig,
  ChatResponse,
  MemorySearchResult,
  NexiStats,
} from './api/index.js';

// Core classes (for advanced usage)
export { Nexi, ChatOptions, NexiOptions } from './core/nexi.js';
export { SentimentAnalyzer, SentimentResult } from './core/sentiment.js';
export {
  PersonalityConfig,
  PersonalityTraits,
  PersonalityInput,
  PERSONALITY_PRESETS,
  getPreset,
  listPresets,
} from './core/personality.js';
export { logger, createLogger, LogLevel, LogEntry, LogHandler } from './utils/logger.js';
export { StateManager } from './core/state.js';
export { MemoryStore } from './memory/store.js';
export { buildSystemPrompt, buildMemoryExtractionPrompt } from './core/prompt.js';
export { detectMode, getModeConfig, getModeName, parseModeCommand } from './core/modes.js';
export { LLMProvider, LLMProviderConfig, GenerateOptions } from './core/providers/llm.js';
export { OllamaProvider } from './core/providers/ollama.js';
export * from './types/index.js';

// Legacy quick start helper (use NexiAPI.create() instead)
import { Nexi } from './core/nexi.js';
import { OllamaProvider } from './core/providers/ollama.js';
import { LLMProvider } from './core/providers/llm.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create a new Nexi instance with default configuration (Ollama backend)
 * @deprecated Use NexiAPI.create() instead for the new simplified API
 */
export function createNexiLegacy(options?: { dataDir?: string; provider?: LLMProvider }): Nexi {
  dotenv.config();

  const provider = options?.provider ?? OllamaProvider.fromEnv();

  return new Nexi(
    {
      dataDir: options?.dataDir || process.env.NEXI_DATA_DIR || path.join(__dirname, '../data'),
    },
    provider
  );
}
