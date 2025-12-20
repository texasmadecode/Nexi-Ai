// Nexi Core - The main personality engine

import { LLMProvider } from './providers/llm.js';
import { OllamaProvider } from './providers/ollama.js';
import { StateManager } from './state.js';
import { MemoryStore } from '../memory/store.js';
import { buildSystemPrompt, buildMemoryExtractionPrompt } from './prompt.js';
import { detectMode, parseModeCommand } from './modes.js';
import { SentimentAnalyzer } from './sentiment.js';
import {
  PersonalityConfig,
  PersonalityInput,
  DEFAULT_PERSONALITY,
  validatePersonality,
  getPersonalityPrompt,
  getPreset,
} from './personality.js';
import { createLogger } from '../utils/logger.js';
import {
  NexiConfig,
  NexiState,
  Memory,
  ConversationMessage,
  BehavioralMode,
  MemoryType,
} from '../types/index.js';

const log = createLogger('nexi');

// Mode-specific generation parameters
const MODE_PARAMS: Record<BehavioralMode, { maxTokens: number; temperature: number }> = {
  react: { maxTokens: 60, temperature: 0.9 },
  chat: { maxTokens: 220, temperature: 0.8 },
  think: { maxTokens: 700, temperature: 0.6 },
  offline: { maxTokens: 500, temperature: 0.5 },
};

const DEFAULT_CONFIG = {
  maxContextMessages: 20,
  maxRelevantMemories: 5,
};

export interface ChatOptions {
  stream?: boolean;
  onToken?: (token: string) => void;
}

export interface NexiOptions {
  useLLMSentiment?: boolean;
  personality?: PersonalityInput | string; // Config object or preset name
}

export class Nexi {
  private readonly provider: LLMProvider;
  private readonly config: NexiConfig;
  private readonly stateManager: StateManager;
  private readonly memoryStore: MemoryStore;
  private readonly sentimentAnalyzer: SentimentAnalyzer;
  private personality: PersonalityConfig;
  private conversationHistory: ConversationMessage[] = [];

  constructor(
    config: Partial<NexiConfig> & { dataDir: string },
    provider?: LLMProvider,
    options?: NexiOptions
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config } as NexiConfig;
    this.provider = provider ?? OllamaProvider.fromEnv();
    this.memoryStore = new MemoryStore(this.config.dataDir);

    // Wire up embedding generator for semantic memory search
    this.memoryStore.setEmbeddingGenerator((text) => this.provider.embed(text));

    // Set up sentiment analyzer
    this.sentimentAnalyzer = new SentimentAnalyzer();
    if (options?.useLLMSentiment !== false) {
      this.sentimentAnalyzer.setProvider(this.provider);
    }

    // Set up personality
    if (typeof options?.personality === 'string') {
      this.personality = getPreset(options.personality) || DEFAULT_PERSONALITY;
    } else if (options?.personality) {
      this.personality = validatePersonality(options.personality);
    } else {
      this.personality = DEFAULT_PERSONALITY;
    }

    const savedState = this.memoryStore.loadState<Partial<NexiState>>('nexi_state');
    this.stateManager = new StateManager(savedState ?? undefined);
    this.saveState();

    log.info('Nexi initialized', { dataDir: config.dataDir, personality: this.personality.name });
  }

  async isProviderAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  async chat(userInput: string, options: ChatOptions = {}): Promise<string> {
    log.debug('Chat started', { inputLength: userInput.length });

    const { mode: requestedMode, cleanedInput } = parseModeCommand(userInput);
    const input = cleanedInput || userInput;

    const currentState = this.stateManager.getState();
    const mode = requestedMode ?? detectMode(input, currentState.mode);

    if (mode !== currentState.mode) {
      this.stateManager.setMode(mode);
    }

    this.stateManager.recordInteraction();
    this.conversationHistory.push({ role: 'user', content: input, timestamp: new Date() });

    // Use semantic search for better memory recall (falls back to keyword if unavailable)
    const relevantMemories = await this.memoryStore.findRelevantSemantic(
      input,
      this.config.maxRelevantMemories
    );
    const state = this.stateManager.getState();
    const basePrompt = buildSystemPrompt(state, relevantMemories);
    const personalityPrompt = getPersonalityPrompt(this.personality);
    const systemPrompt = basePrompt + personalityPrompt;

    // Build conversation context efficiently
    const contextMsgs = this.conversationHistory.slice(-this.config.maxContextMessages);
    const context = contextMsgs
      .map((m) => (m.role === 'user' ? 'User: ' : 'Nexi: ') + m.content)
      .join('\n\n');
    const fullPrompt = systemPrompt + '\n\n---\n\nConversation:\n' + context + '\n\nNexi:';

    const params = MODE_PARAMS[state.mode];

    const response = await this.provider.generate(fullPrompt, {
      mode: state.mode,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      stream: options.stream ?? false,
      onToken: options.onToken,
    });

    this.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      mode: state.mode,
    });

    // Use sync mood analysis for speed (async available via analyzeMoodAsync)
    this.analyzeMoodSync(input);
    this.saveState();

    log.debug('Chat completed', { mode: state.mode, responseLength: response.length });
    return response;
  }

  async processMemories(): Promise<Memory[]> {
    if (this.conversationHistory.length < 2) return [];

    const recent = this.conversationHistory.slice(-10);
    const convo = recent
      .map((m) => (m.role === 'user' ? 'User: ' : 'Nexi: ') + m.content)
      .join('\n\n');

    try {
      const prompt =
        'You are a memory extraction system. Respond only with valid JSON.\n\n' +
        buildMemoryExtractionPrompt(convo);

      const text = await this.provider.generate(prompt, {
        mode: 'offline',
        maxTokens: MODE_PARAMS.offline.maxTokens,
        temperature: 0.3,
        stream: false,
      });

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return [];

      const extracted = JSON.parse(match[0]);
      const memories: Memory[] = [];

      for (const m of extracted.memories || []) {
        const memory = await this.memoryStore.storeWithEmbedding({
          type: m.type as MemoryType,
          content: m.content,
          importance: m.importance,
          emotional_weight: m.emotional_weight,
          tags: m.tags || [],
        });
        memories.push(memory);
      }

      return memories;
    } catch {
      return [];
    }
  }

  remember(content: string, type: MemoryType = 'request', importance = 7): Memory {
    // Sync version for backwards compatibility
    return this.memoryStore.store({
      type,
      content,
      importance,
      emotional_weight: 0,
      tags: ['explicit-request'],
    });
  }

  async rememberWithEmbedding(
    content: string,
    type: MemoryType = 'request',
    importance = 7
  ): Promise<Memory> {
    return this.memoryStore.storeWithEmbedding({
      type,
      content,
      importance,
      emotional_weight: 0,
      tags: ['explicit-request'],
    });
  }

  searchMemories(query: string): Memory[] {
    return this.memoryStore.findRelevant(query, 10);
  }

  async searchMemoriesSemantic(query: string): Promise<Memory[]> {
    return this.memoryStore.findRelevantSemantic(query, 10);
  }

  getState(): NexiState {
    return this.stateManager.getState();
  }

  setMode(mode: BehavioralMode): void {
    this.stateManager.setMode(mode);
    this.saveState();
  }

  getMemoryStats() {
    return this.memoryStore.getStats();
  }

  clearConversation(): void {
    this.conversationHistory = [];
  }

  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Export conversation and state to JSON
   */
  exportConversation(): string {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      state: this.stateManager.toJSON(),
      conversation: this.conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        mode: msg.mode,
      })),
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import conversation from exported JSON
   */
  importConversation(jsonData: string): { success: boolean; messagesImported: number; error?: string } {
    try {
      const data = JSON.parse(jsonData);

      // Validate structure
      if (!data.conversation || !Array.isArray(data.conversation)) {
        return { success: false, messagesImported: 0, error: 'Invalid format: missing conversation array' };
      }

      // Import conversation history
      const messages: ConversationMessage[] = data.conversation.map(
        (msg: { role: string; content: string; timestamp: string; mode?: string }) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          mode: msg.mode as BehavioralMode | undefined,
        })
      );

      this.conversationHistory = messages;

      log.info('Conversation imported', { messagesImported: messages.length });
      return { success: true, messagesImported: messages.length };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error('Failed to import conversation', { error: errorMessage });
      return { success: false, messagesImported: 0, error: errorMessage };
    }
  }

  runMemoryDecay(): number {
    return this.memoryStore.decay();
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Get current personality configuration
   */
  getPersonality(): PersonalityConfig {
    return { ...this.personality };
  }

  /**
   * Set personality (by config or preset name)
   */
  setPersonality(personality: PersonalityInput | string): void {
    if (typeof personality === 'string') {
      this.personality = getPreset(personality) || DEFAULT_PERSONALITY;
    } else {
      this.personality = validatePersonality(personality);
    }
    log.info('Personality changed', { name: this.personality.name });
  }

  /**
   * Analyze mood from input using rule-based sentiment (sync, fast)
   */
  private analyzeMoodSync(input: string): void {
    const result = this.sentimentAnalyzer.analyzeRuleBased(input);

    if (result.mood !== 'neutral' && result.confidence > 0.3) {
      this.stateManager.shiftMood(result.mood, result.confidence > 0.6 ? 2 : 1);
    }

    if (result.energy !== 'neutral') {
      this.stateManager.adjustEnergy(result.energy);
    }

    // Long conversations drain energy
    if (this.conversationHistory.length > 15) {
      this.stateManager.adjustEnergy('down');
    }
  }

  /**
   * Analyze mood using LLM sentiment detection (async, more accurate)
   */
  async analyzeMoodAsync(input: string): Promise<void> {
    const result = await this.sentimentAnalyzer.analyze(input);

    if (result.mood !== 'neutral' && result.confidence > 0.3) {
      this.stateManager.shiftMood(result.mood, result.confidence > 0.6 ? 2 : 1);
    }

    if (result.energy !== 'neutral') {
      this.stateManager.adjustEnergy(result.energy);
    }

    // Long conversations drain energy
    if (this.conversationHistory.length > 15) {
      this.stateManager.adjustEnergy('down');
    }
  }

  private saveState(): void {
    this.memoryStore.saveState('nexi_state', this.stateManager.toJSON());
  }

  shutdown(): void {
    this.saveState();
    this.memoryStore.close();
  }
}
