// Nexi Core - The main personality engine

import { LLMProvider } from './providers/llm.js';
import { OllamaProvider } from './providers/ollama.js';
import { StateManager } from './state.js';
import { MemoryStore } from '../memory/store.js';
import { buildSystemPrompt, buildMemoryExtractionPrompt } from './prompt.js';
import { detectMode, parseModeCommand } from './modes.js';
import {
  NexiConfig,
  NexiState,
  Memory,
  ConversationMessage,
  BehavioralMode,
  MemoryType,
} from '../types/index.js';

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

export class Nexi {
  private readonly provider: LLMProvider;
  private readonly config: NexiConfig;
  private readonly stateManager: StateManager;
  private readonly memoryStore: MemoryStore;
  private conversationHistory: ConversationMessage[] = [];

  constructor(config: Partial<NexiConfig> & { dataDir: string }, provider?: LLMProvider) {
    this.config = { ...DEFAULT_CONFIG, ...config } as NexiConfig;
    this.provider = provider ?? OllamaProvider.fromEnv();
    this.memoryStore = new MemoryStore(this.config.dataDir);

    const savedState = this.memoryStore.loadState<Partial<NexiState>>('nexi_state');
    this.stateManager = new StateManager(savedState ?? undefined);
    this.saveState();
  }

  async isProviderAvailable(): Promise<boolean> {
    return this.provider.isAvailable();
  }

  async chat(userInput: string, options: ChatOptions = {}): Promise<string> {
    const { mode: requestedMode, cleanedInput } = parseModeCommand(userInput);
    const input = cleanedInput || userInput;

    const currentState = this.stateManager.getState();
    const mode = requestedMode ?? detectMode(input, currentState.mode);

    if (mode !== currentState.mode) {
      this.stateManager.setMode(mode);
    }

    this.stateManager.recordInteraction();
    this.conversationHistory.push({ role: 'user', content: input, timestamp: new Date() });

    const relevantMemories = this.memoryStore.findRelevant(input, this.config.maxRelevantMemories);
    const state = this.stateManager.getState();
    const systemPrompt = buildSystemPrompt(state, relevantMemories);

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

    this.analyzeMood(input);
    this.saveState();

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
        memories.push(
          this.memoryStore.store({
            type: m.type as MemoryType,
            content: m.content,
            importance: m.importance,
            emotional_weight: m.emotional_weight,
            tags: m.tags || [],
          })
        );
      }

      return memories;
    } catch {
      return [];
    }
  }

  remember(content: string, type: MemoryType = 'request', importance = 7): Memory {
    return this.memoryStore.store({
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

  runMemoryDecay(): number {
    return this.memoryStore.decay();
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  private analyzeMood(input: string): void {
    const lower = input.toLowerCase();

    if (/thank|awesome|great|love/.test(lower)) {
      this.stateManager.shiftMood('warm', 1);
      this.stateManager.adjustEnergy('up');
    } else if (lower.includes('?') && lower.length > 50) {
      this.stateManager.shiftMood('curious', 1);
    } else if (/frustrated|annoying|stupid/.test(lower)) {
      this.stateManager.shiftMood('focused', 1);
    }

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
