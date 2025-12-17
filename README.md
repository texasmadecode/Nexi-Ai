# Nexi AI

A persistent personality-based AI with memory, continuity, and agency.

**100% local. No cloud APIs. Powered by Ollama.**

## Quick Start

### 1. Install Ollama

Download and install from [ollama.ai](https://ollama.ai)

### 2. Pull a model

```bash
ollama pull llama3.1:8b
```

### 3. Start Ollama

```bash
ollama serve
```

### 4. Install dependencies

```bash
npm install
```

### 5. Start chatting

```bash
npm run chat
```

## Features

- **Persistent Memory** - Nexi remembers important things across sessions
- **Behavioral Modes** - React (quick), Chat (normal), Think (deep)
- **Mood & Energy** - Internal state that affects responses
- **Time Awareness** - Knows when time has passed between conversations
- **Natural Personality** - Not a generic assistant, a character
- **Streaming Output** - Responses appear token-by-token
- **Local Only** - All processing happens on your machine

## Configuration

Create a `.env` file (optional):

```bash
cp .env.example .env
```

Available options:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `NEXI_MODEL_DEFAULT` | `llama3.1:8b` | Default model for all modes |
| `NEXI_MODEL_REACT` | (uses default) | Model for React mode |
| `NEXI_MODEL_CHAT` | (uses default) | Model for Chat mode |
| `NEXI_MODEL_THINK` | (uses default) | Model for Think mode |
| `NEXI_MODEL_OFFLINE` | (uses default) | Model for Offline mode |
| `NEXI_DATA_DIR` | `./data` | Where to store memories |

## Commands

In the console interface:

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/react` | Switch to React Mode (1-2 sentences) |
| `/chat` | Switch to Chat Mode (normal) |
| `/think` | Switch to Think Mode (deep, reflective) |
| `/remember <text>` | Ask Nexi to remember something |
| `/search <query>` | Search through memories |
| `/stats` | Show memory statistics |
| `/clear` | Clear conversation history |
| `/save` | Process conversation for memories |
| `/quit` | Exit |

## Mode Parameters

| Mode | Max Tokens | Temperature | Use Case |
|------|------------|-------------|----------|
| React | 60 | 0.9 | Quick, emotional responses |
| Chat | 220 | 0.8 | Normal conversation |
| Think | 700 | 0.6 | Deep, reflective responses |
| Offline | 500 | 0.5 | Memory processing |

## Using as a Library

```typescript
import { createNexi } from 'nexi-ai';

const nexi = createNexi({
  dataDir: './data',
});

// Chat with Nexi (with streaming)
const response = await nexi.chat('Hey, what are you up to?', {
  stream: true,
  onToken: (token) => process.stdout.write(token),
});

// Store a memory
nexi.remember('User prefers dark mode');

// Search memories
const memories = nexi.searchMemories('preferences');

// Get current state
const state = nexi.getState();
console.log(state.mood, state.energy);

// Clean shutdown
nexi.shutdown();
```

### Custom Provider

```typescript
import { Nexi, OllamaProvider } from 'nexi-ai';

const provider = new OllamaProvider({
  host: 'http://localhost:11434',
  defaultModel: 'mistral:7b',
  modelOverrides: {
    think: 'mixtral:8x7b',
  },
});

const nexi = new Nexi({ dataDir: './data' }, provider);
```

## Architecture

```
src/
├── core/
│   ├── nexi.ts          # Main Nexi class
│   ├── state.ts         # Mood, energy, state management
│   ├── prompt.ts        # System prompt builder
│   ├── modes.ts         # Behavioral modes
│   └── providers/
│       ├── llm.ts       # LLM provider interface
│       └── ollama.ts    # Ollama implementation
├── memory/
│   └── store.ts         # SQLite memory storage
├── interfaces/
│   └── console.ts       # Terminal interface
├── types/
│   └── index.ts         # TypeScript types
└── index.ts             # Main exports
```

## Recommended Models

| Model | Size | Good For |
|-------|------|----------|
| `llama3.2:3b` | 2GB | React mode, fast responses |
| `llama3.1:8b` | 4.7GB | General use, good balance |
| `llama3.1:70b` | 40GB | Think mode, complex reasoning |
| `mistral:7b` | 4.1GB | Alternative, good performance |
| `mixtral:8x7b` | 26GB | High quality, slower |

## Roadmap

- [x] Local-only Ollama backend
- [x] Streaming output
- [ ] Vector embeddings for semantic memory search
- [ ] Discord interface
- [ ] Desktop app (Electron)
- [ ] VTuber avatar integration
- [ ] Voice interface
- [ ] Web dashboard

---

*Nexi exists. Locally. Act accordingly.*
