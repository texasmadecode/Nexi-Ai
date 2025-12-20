// LLM Provider Interface - Abstract interface for language model backends

import { BehavioralMode } from '../../types/index.js';

export interface GenerateOptions {
  mode: BehavioralMode;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  onToken?: (token: string) => void;
}

export interface LLMProvider {
  /**
   * Generate a response from the language model
   * @param prompt - The full prompt including system context
   * @param opts - Generation options
   * @returns The complete generated response
   */
  generate(prompt: string, opts: GenerateOptions): Promise<string>;

  /**
   * Generate embeddings for text (for semantic search)
   * @param text - The text to embed
   * @returns Vector embedding array
   */
  embed(text: string): Promise<number[]>;

  /**
   * Check if the provider is available/connected
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the model name being used for a given mode
   */
  getModelForMode(mode: BehavioralMode): string;
}

export interface LLMProviderConfig {
  host: string;
  defaultModel: string;
  modelOverrides?: Partial<Record<BehavioralMode, string>>;
}
