// Nexi Core Types

export type BehavioralMode = 'react' | 'chat' | 'think' | 'offline';

export type MoodState =
  | 'neutral'
  | 'curious'
  | 'playful'
  | 'tired'
  | 'focused'
  | 'irritated'
  | 'warm'
  | 'withdrawn'
  | 'excited';

export type EnergyLevel = 'low' | 'medium' | 'high';

export interface NexiState {
  mood: MoodState;
  energy: EnergyLevel;
  mode: BehavioralMode;
  lastInteraction: Date | null;
  sessionStart: Date;
  interactionCount: number;
}

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  context?: string;
  importance: number; // 1-10
  emotional_weight: number; // -5 to 5 (negative = unpleasant, positive = pleasant)
  created_at: Date;
  last_accessed: Date;
  access_count: number;
  tags: string[];
  related_user?: string;
}

export type MemoryType =
  | 'preference' // "likes X", "dislikes Y"
  | 'fact' // learned information about user/world
  | 'event' // something that happened
  | 'milestone' // relationship milestone
  | 'reflection' // Nexi's own thoughts
  | 'request' // user explicitly asked to remember something
  | 'pattern'; // recurring theme noticed

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode?: BehavioralMode;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  currentTopic?: string;
  relevantMemories: Memory[];
  state: NexiState;
}

export interface NexiConfig {
  dataDir: string;
  maxContextMessages: number;
  maxRelevantMemories: number;
}

export interface MemoryQuery {
  type?: MemoryType;
  tags?: string[];
  minImportance?: number;
  search?: string;
  limit?: number;
}
