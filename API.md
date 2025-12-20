# Nexi AI API Reference

Complete API documentation for Nexi AI - a persistent personality-based AI with memory, mood, and behavioral modes.

## Table of Contents

- [Core Classes](#core-classes)
  - [Nexi](#nexi)
  - [MemoryStore](#memorystore)
  - [StateManager](#statemanager)
  - [SentimentAnalyzer](#sentimentanalyzer)
- [Providers](#providers)
  - [LLMProvider Interface](#llmprovider-interface)
  - [OllamaProvider](#ollamaprovider)
- [Types](#types)
- [Utilities](#utilities)
  - [Logger](#logger)

---

## Core Classes

### Nexi

The main personality engine class.

```typescript
import { Nexi } from 'nexi-ai';
```

#### Constructor

```typescript
constructor(
  config: Partial<NexiConfig> & { dataDir: string },
  provider?: LLMProvider,
  options?: NexiOptions
)
```

**Parameters:**
- `config.dataDir` (required): Directory path for storing memory database
- `config.maxContextMessages`: Max conversation messages to include in context (default: 20)
- `config.maxRelevantMemories`: Max memories to retrieve per query (default: 5)
- `provider`: LLM provider instance (default: OllamaProvider.fromEnv())
- `options.useLLMSentiment`: Enable LLM-based sentiment analysis (default: true)

#### Methods

##### chat(userInput, options?)

Generate a response to user input.

```typescript
async chat(userInput: string, options?: ChatOptions): Promise<string>
```

**ChatOptions:**
- `stream`: Enable streaming response (default: false)
- `onToken`: Callback for each token when streaming

**Example:**
```typescript
const response = await nexi.chat('Hello!');

// With streaming
await nexi.chat('Tell me a story', {
  stream: true,
  onToken: (token) => process.stdout.write(token)
});
```

##### remember(content, type?, importance?)

Store an explicit memory (synchronous, no embedding).

```typescript
remember(content: string, type?: MemoryType, importance?: number): Memory
```

##### rememberWithEmbedding(content, type?, importance?)

Store a memory with vector embedding for semantic search.

```typescript
async rememberWithEmbedding(
  content: string,
  type?: MemoryType,
  importance?: number
): Promise<Memory>
```

##### searchMemories(query)

Search memories using keyword matching.

```typescript
searchMemories(query: string): Memory[]
```

##### searchMemoriesSemantic(query)

Search memories using semantic similarity.

```typescript
async searchMemoriesSemantic(query: string): Promise<Memory[]>
```

##### processMemories()

Extract and store memories from recent conversation.

```typescript
async processMemories(): Promise<Memory[]>
```

##### getState()

Get current internal state.

```typescript
getState(): NexiState
```

##### setMode(mode)

Set behavioral mode.

```typescript
setMode(mode: BehavioralMode): void
```

##### getConversationHistory()

Get conversation history.

```typescript
getConversationHistory(): ConversationMessage[]
```

##### clearConversation()

Clear conversation history.

```typescript
clearConversation(): void
```

##### exportConversation()

Export conversation and state to JSON.

```typescript
exportConversation(): string
```

##### importConversation(jsonData)

Import conversation from exported JSON.

```typescript
importConversation(jsonData: string): {
  success: boolean;
  messagesImported: number;
  error?: string
}
```

##### getMemoryStats()

Get memory statistics.

```typescript
getMemoryStats(): {
  total: number;
  byType: Record<string, number>;
  avgImportance: number
}
```

##### runMemoryDecay()

Remove old, low-importance memories.

```typescript
runMemoryDecay(): number  // Returns count of deleted memories
```

##### isProviderAvailable()

Check if LLM provider is available.

```typescript
async isProviderAvailable(): Promise<boolean>
```

##### shutdown()

Save state and close database connection.

```typescript
shutdown(): void
```

---

### MemoryStore

SQLite-backed persistent memory storage.

```typescript
import { MemoryStore } from 'nexi-ai';
```

#### Constructor

```typescript
constructor(dataDir: string)
```

#### Methods

##### store(memory)

Store a new memory with input validation.

```typescript
store(memory: Omit<Memory, 'id' | 'created_at' | 'last_accessed' | 'access_count'>): Memory
```

**Note:** `importance` is clamped to 1-10, `emotional_weight` is clamped to -5 to 5.

##### storeWithEmbedding(memory)

Store a memory with vector embedding.

```typescript
async storeWithEmbedding(
  memory: Omit<Memory, 'id' | 'created_at' | 'last_accessed' | 'access_count'>
): Promise<Memory>
```

##### query(query)

Query memories with filters.

```typescript
query(query: MemoryQuery): Memory[]
```

**MemoryQuery:**
- `type`: Filter by memory type
- `minImportance`: Minimum importance score
- `search`: Text search in content/context
- `tags`: Array of tags to match
- `limit`: Maximum results

##### findRelevant(text, limit?)

Find relevant memories using keyword matching.

```typescript
findRelevant(text: string, limit?: number): Memory[]
```

##### findRelevantSemantic(text, limit?)

Find relevant memories using semantic similarity.

```typescript
async findRelevantSemantic(text: string, limit?: number): Promise<Memory[]>
```

##### setEmbeddingGenerator(generator)

Set the embedding function for semantic search.

```typescript
setEmbeddingGenerator(generator: (text: string) => Promise<number[]>): void
```

##### get(id)

Get a memory by ID.

```typescript
get(id: string): Memory | null
```

##### update(id, updates)

Update a memory.

```typescript
update(id: string, updates: Partial<Pick<Memory, 'content' | 'context' | 'importance' | 'emotional_weight' | 'tags'>>): boolean
```

##### delete(id)

Delete a memory.

```typescript
delete(id: string): boolean
```

##### decay(daysOld?, maxImportance?)

Remove old, low-importance memories.

```typescript
decay(daysOld?: number, maxImportance?: number): number
```

##### saveState(key, value)

Save arbitrary state.

```typescript
saveState(key: string, value: any): void
```

##### loadState<T>(key)

Load saved state.

```typescript
loadState<T>(key: string): T | null
```

##### getStats()

Get memory statistics.

```typescript
getStats(): { total: number; byType: Record<string, number>; avgImportance: number }
```

##### close()

Close database connection.

```typescript
close(): void
```

---

### StateManager

Manages Nexi's internal state (mood, energy, mode).

```typescript
import { StateManager } from 'nexi-ai';
```

#### Methods

##### getState()

Get current state.

```typescript
getState(): NexiState
```

##### setMode(mode)

Set behavioral mode.

```typescript
setMode(mode: BehavioralMode): void
```

##### shiftMood(mood, intensity?)

Shift current mood.

```typescript
shiftMood(mood: MoodState, intensity?: number): void
```

##### adjustEnergy(direction)

Adjust energy level.

```typescript
adjustEnergy(direction: 'up' | 'down'): void
```

##### recordInteraction()

Record an interaction (updates count and timestamp).

```typescript
recordInteraction(): void
```

##### toJSON()

Serialize state for persistence.

```typescript
toJSON(): object
```

---

### SentimentAnalyzer

Mood detection from user input.

```typescript
import { SentimentAnalyzer } from 'nexi-ai';
```

#### Methods

##### setProvider(provider)

Set LLM provider for enhanced analysis.

```typescript
setProvider(provider: LLMProvider): void
```

##### analyzeRuleBased(input)

Fast rule-based sentiment analysis.

```typescript
analyzeRuleBased(input: string): SentimentResult
```

##### analyze(input)

LLM-enhanced sentiment analysis (falls back to rule-based).

```typescript
async analyze(input: string): Promise<SentimentResult>
```

**SentimentResult:**
```typescript
interface SentimentResult {
  mood: MoodState | 'neutral';
  energy: 'up' | 'down' | 'neutral';
  confidence: number;  // 0.0 to 1.0
}
```

---

## Providers

### LLMProvider Interface

Interface for LLM backends.

```typescript
interface LLMProvider {
  generate(prompt: string, opts: GenerateOptions): Promise<string>;
  embed(text: string): Promise<number[]>;
  isAvailable(): Promise<boolean>;
  getModelForMode(mode: BehavioralMode): string;
}
```

**GenerateOptions:**
```typescript
interface GenerateOptions {
  mode: BehavioralMode;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  onToken?: (token: string) => void;
}
```

### OllamaProvider

Ollama-based LLM provider.

```typescript
import { OllamaProvider } from 'nexi-ai';
```

#### Static Methods

##### fromEnv()

Create provider from environment variables.

```typescript
static fromEnv(): OllamaProvider
```

**Environment Variables:**
- `OLLAMA_HOST`: Ollama server URL (default: `http://localhost:11434`)
- `NEXI_MODEL_DEFAULT`: Default model (default: `llama3.1:8b`)
- `NEXI_MODEL_REACT`: Model for react mode
- `NEXI_MODEL_CHAT`: Model for chat mode
- `NEXI_MODEL_THINK`: Model for think mode
- `NEXI_MODEL_OFFLINE`: Model for offline mode
- `NEXI_EMBEDDING_MODEL`: Embedding model (default: `nomic-embed-text`)

---

## Types

### BehavioralMode

```typescript
type BehavioralMode = 'react' | 'chat' | 'think' | 'offline';
```

- **react**: Quick, emotional responses (1-2 sentences)
- **chat**: Normal conversation depth
- **think**: Slower, reflective, strategic
- **offline**: Internal processing only

### MoodState

```typescript
type MoodState = 'curious' | 'playful' | 'focused' | 'warm' | 'reflective' | 'tired' | 'excited' | 'neutral';
```

### EnergyLevel

```typescript
type EnergyLevel = 'high' | 'medium' | 'low';
```

### MemoryType

```typescript
type MemoryType = 'fact' | 'preference' | 'event' | 'milestone' | 'reflection' | 'request' | 'pattern';
```

### Memory

```typescript
interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  context?: string;
  importance: number;        // 1-10
  emotional_weight: number;  // -5 to 5
  created_at: Date;
  last_accessed: Date;
  access_count: number;
  tags: string[];
  related_user?: string;
}
```

### NexiState

```typescript
interface NexiState {
  mode: BehavioralMode;
  mood: MoodState;
  energy: EnergyLevel;
  interactionCount: number;
  lastInteraction: Date | null;
}
```

### ConversationMessage

```typescript
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode?: BehavioralMode;
}
```

---

## Utilities

### Logger

Structured logging with configurable levels.

```typescript
import { logger, createLogger, LogLevel } from 'nexi-ai';
```

#### Global Logger

##### setLevel(level)

Set log level.

```typescript
logger.setLevel(level: LogLevel): void
```

**LogLevel:** `'debug' | 'info' | 'warn' | 'error' | 'none'`

##### addHandler(handler)

Add custom log handler.

```typescript
logger.addHandler(handler: LogHandler): void

type LogHandler = (entry: LogEntry) => void;

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}
```

#### Category Logger

Create category-specific loggers.

```typescript
const log = createLogger('my-module');

log.debug('Debug message');
log.info('Info message');
log.warn('Warning message');
log.error('Error message', { errorCode: 123 });
```

---

## Quick Start

```typescript
import { createNexi } from 'nexi-ai';

// Create Nexi instance
const nexi = createNexi({ dataDir: './nexi-data' });

// Chat
const response = await nexi.chat('Hello!');
console.log(response);

// Remember something
await nexi.rememberWithEmbedding('User prefers dark mode', 'preference', 6);

// Search memories
const memories = await nexi.searchMemoriesSemantic('display settings');

// Export conversation
const exported = nexi.exportConversation();
fs.writeFileSync('conversation.json', exported);

// Cleanup
nexi.shutdown();
```
