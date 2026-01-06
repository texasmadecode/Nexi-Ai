/**
 * Nexi AI - Simple Internal API
 *
 * Easy-to-use programmatic interface for Nexi.
 * Import and use in any TypeScript/JavaScript project.
 */

import { Nexi, NexiOptions } from '../core/nexi.js';
import { OllamaProvider } from '../core/providers/ollama.js';
import {
  NexiConfig,
  NexiState,
  Memory,
  MemoryType,
  BehavioralMode,
  MoodState,
} from '../types/index.js';
import {
  PersonalityConfig,
  PersonalityInput,
  getPreset,
  listPresets,
} from '../core/personality.js';
import { logger, LogLevel } from '../utils/logger.js';

// Re-export types for convenience
export type {
  NexiConfig,
  NexiState,
  Memory,
  MemoryType,
  BehavioralMode,
  MoodState,
  PersonalityConfig,
  PersonalityInput,
  NexiOptions,
  LogLevel,
};

/**
 * Configuration for creating a Nexi instance
 */
export interface NexiAPIConfig {
  /** Directory to store data (memories, state). Default: ./nexi-data */
  dataDir?: string;

  /** Ollama server URL. Default: http://localhost:11434 */
  ollamaUrl?: string;

  /** Ollama model to use. Default: llama3.1:8b */
  model?: string;

  /** Embedding model for semantic search. Default: nomic-embed-text */
  embeddingModel?: string;

  /** Personality preset name or custom config */
  personality?: string | PersonalityInput;

  /** Use LLM for sentiment analysis (slower but more accurate) */
  useLLMSentiment?: boolean;

  /** Log level: 'debug' | 'info' | 'warn' | 'error' | 'none' */
  logLevel?: LogLevel | 'none';

  /** Max messages to keep in context. Default: 20 */
  maxContextMessages?: number;

  /** Max relevant memories to include. Default: 5 */
  maxRelevantMemories?: number;
}

/**
 * Chat response with metadata
 */
export interface ChatResponse {
  /** The response text */
  message: string;

  /** Current mood after response */
  mood: MoodState;

  /** Current energy level */
  energy: 'high' | 'medium' | 'low';

  /** Current behavioral mode */
  mode: BehavioralMode;

  /** Number of interactions this session */
  interactions: number;
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
  memories: Memory[];
  count: number;
}

/**
 * Stats about Nexi's current state
 */
export interface NexiStats {
  mode: BehavioralMode;
  mood: MoodState;
  energy: 'high' | 'medium' | 'low';
  interactions: number;
  memories: {
    total: number;
    byType: Record<string, number>;
    averageImportance: number;
  };
}

/**
 * Nexi AI API - Simple, customizable interface
 *
 * @example
 * ```typescript
 * import { NexiAPI } from 'nexi-ai';
 *
 * const nexi = await NexiAPI.create({ model: 'llama3.1:8b' });
 * const response = await nexi.chat('Hello!');
 * console.log(response.message);
 * ```
 */
export class NexiAPI {
  private nexi: Nexi;
  private config: NexiAPIConfig;

  private constructor(nexi: Nexi, config: NexiAPIConfig) {
    this.nexi = nexi;
    this.config = config;
  }

  /**
   * Create a new Nexi instance
   */
  static async create(config: NexiAPIConfig = {}): Promise<NexiAPI> {
    // Set up logging
    if (config.logLevel === 'none') {
      logger.setLevel('error');
    } else if (config.logLevel) {
      logger.setLevel(config.logLevel);
    }

    // Set embedding model via env if provided
    if (config.embeddingModel) {
      process.env.NEXI_EMBEDDING_MODEL = config.embeddingModel;
    }

    // Create provider
    const provider = new OllamaProvider({
      host: config.ollamaUrl || 'http://localhost:11434',
      defaultModel: config.model || 'llama3.1:8b',
    });

    // Create Nexi config
    const nexiConfig: NexiConfig = {
      dataDir: config.dataDir || './nexi-data',
      maxContextMessages: config.maxContextMessages || 20,
      maxRelevantMemories: config.maxRelevantMemories || 5,
    };

    // Create Nexi options
    const nexiOptions: NexiOptions = {
      useLLMSentiment: config.useLLMSentiment,
      personality: config.personality,
    };

    // Create instance
    const nexi = new Nexi(nexiConfig, provider, nexiOptions);

    return new NexiAPI(nexi, config);
  }

  /**
   * Send a message and get a response
   */
  async chat(message: string): Promise<ChatResponse> {
    const response = await this.nexi.chat(message);
    const state = this.nexi.getState();

    return {
      message: response,
      mood: state.mood,
      energy: state.energy,
      mode: state.mode,
      interactions: state.interactionCount,
    };
  }

  /**
   * Send a message with streaming response
   */
  async chatStream(message: string, onToken: (token: string) => void): Promise<ChatResponse> {
    const response = await this.nexi.chat(message, {
      stream: true,
      onToken,
    });
    const state = this.nexi.getState();

    return {
      message: response,
      mood: state.mood,
      energy: state.energy,
      mode: state.mode,
      interactions: state.interactionCount,
    };
  }

  /**
   * Store a memory
   */
  remember(content: string, options?: { type?: MemoryType; importance?: number }): Memory {
    return this.nexi.remember(content, options?.type || 'request', options?.importance || 7);
  }

  /**
   * Store a memory with embedding for semantic search
   */
  async rememberWithEmbedding(
    content: string,
    options?: { type?: MemoryType; importance?: number }
  ): Promise<Memory> {
    return this.nexi.rememberWithEmbedding(
      content,
      options?.type || 'request',
      options?.importance || 7
    );
  }

  /**
   * Search memories by keyword
   */
  searchMemories(query: string): MemorySearchResult {
    const memories = this.nexi.searchMemories(query);
    return { memories, count: memories.length };
  }

  /**
   * Search memories using semantic similarity (requires embeddings)
   */
  async searchMemoriesSemantic(query: string): Promise<MemorySearchResult> {
    const memories = await this.nexi.searchMemoriesSemantic(query);
    return { memories, count: memories.length };
  }

  /**
   * Set behavioral mode
   */
  setMode(mode: BehavioralMode): void {
    this.nexi.setMode(mode);
  }

  /**
   * Get current mode
   */
  getMode(): BehavioralMode {
    return this.nexi.getState().mode;
  }

  /**
   * Get current mood
   */
  getMood(): MoodState {
    return this.nexi.getState().mood;
  }

  /**
   * Set personality (preset name or custom config)
   */
  setPersonality(personality: string | PersonalityInput): void {
    this.nexi.setPersonality(personality);
  }

  /**
   * Get current personality
   */
  getPersonality(): PersonalityConfig {
    return this.nexi.getPersonality();
  }

  /**
   * Get current state
   */
  getState(): NexiState {
    return this.nexi.getState();
  }

  /**
   * Get stats
   */
  getStats(): NexiStats {
    const state = this.nexi.getState();
    const memStats = this.nexi.getMemoryStats();

    return {
      mode: state.mode,
      mood: state.mood,
      energy: state.energy,
      interactions: state.interactionCount,
      memories: {
        total: memStats.total,
        byType: memStats.byType,
        averageImportance: memStats.avgImportance,
      },
    };
  }

  /**
   * Get conversation history
   */
  getHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this.nexi.getConversationHistory().map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.nexi.clearConversation();
  }

  /**
   * Export conversation to JSON
   */
  exportConversation(): string {
    return this.nexi.exportConversation();
  }

  /**
   * Import conversation from JSON
   */
  importConversation(json: string): { success: boolean; error?: string } {
    const result = this.nexi.importConversation(json);
    return { success: result.success, error: result.error };
  }

  /**
   * Run memory decay (reduce importance of old memories)
   */
  runMemoryDecay(): number {
    return this.nexi.runMemoryDecay();
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    return this.nexi.isProviderAvailable();
  }

  /**
   * Shutdown and save state
   */
  shutdown(): void {
    this.nexi.shutdown();
  }

  /**
   * Get available personality presets
   */
  static getPresets(): string[] {
    return listPresets();
  }

  /**
   * Get a personality preset by name
   */
  static getPreset(name: string): PersonalityConfig | undefined {
    return getPreset(name);
  }
}

/**
 * Quick helper to create and use Nexi in one line
 *
 * @example
 * ```typescript
 * import { createNexi } from 'nexi-ai';
 *
 * const nexi = await createNexi();
 * const { message } = await nexi.chat('Hello!');
 * ```
 */
export async function createNexi(config?: NexiAPIConfig): Promise<NexiAPI> {
  return NexiAPI.create(config);
}

/**
 * Quick one-shot chat (creates instance, chats, shuts down)
 *
 * @example
 * ```typescript
 * import { quickChat } from 'nexi-ai';
 *
 * const response = await quickChat('What is 2+2?');
 * console.log(response);
 * ```
 */
export async function quickChat(message: string, config?: NexiAPIConfig): Promise<string> {
  const nexi = await createNexi(config);
  try {
    const response = await nexi.chat(message);
    return response.message;
  } finally {
    nexi.shutdown();
  }
}
