# Nexi AI - Python Client

A simple Python interface for Nexi AI, a persistent personality-based AI with memory and continuity.

## Installation

```bash
pip install nexi-ai
```

Or install from source:

```bash
cd python
pip install -e .
```

## Requirements

- Python 3.10+
- Ollama running locally (or remote URL)

## Quick Start

```python
from nexi import Nexi

# Create instance (uses defaults)
nexi = Nexi()

# Chat
response = nexi.chat("Hello!")
print(response.message)

# Streaming
def on_token(token):
    print(token, end="", flush=True)

response = nexi.chat_stream("Tell me a story", on_token=on_token)
```

## Configuration

```python
from nexi import Nexi, NexiConfig

config = NexiConfig(
    data_dir="./my-nexi-data",      # Where to store memories/state
    ollama_url="http://localhost:11434",  # Ollama server URL
    model="llama3.1:8b",            # Model to use
    max_context_messages=20,         # Messages to keep in context
)

nexi = Nexi(config)
```

## Features

### Chat

```python
# Simple chat
response = nexi.chat("What's your favorite color?")
print(response.message)
print(f"Mood: {response.mood}")
print(f"Energy: {response.energy}")

# Streaming
for token in nexi.chat_stream("Tell me about yourself"):
    print(token, end="")
```

### Memory

```python
from nexi import MemoryType

# Store a memory
nexi.remember("User loves Python programming", memory_type=MemoryType.FACT)

# Search memories
results = nexi.search_memories("programming")
for memory in results.memories:
    print(f"- {memory.content}")

# Get all memories
all_memories = nexi.get_all_memories()

# Clear memories
nexi.clear_memories()
```

### Mode & Mood

```python
from nexi import BehavioralMode, MoodState

# Set mode
nexi.set_mode(BehavioralMode.THINK)  # For deep discussions
nexi.set_mode(BehavioralMode.REACT)  # For quick replies

# Check mood
print(nexi.get_mood())

# Set mood manually
nexi.set_mood(MoodState.CURIOUS)
```

### State & Stats

```python
# Get current state
state = nexi.get_state()
print(f"Mode: {state.mode}")
print(f"Mood: {state.mood}")
print(f"Interactions: {state.interaction_count}")

# Get statistics
stats = nexi.get_stats()
print(f"Total memories: {stats.total_memories}")
print(f"Average importance: {stats.average_importance}")
```

### Conversation Management

```python
# Get history
history = nexi.get_history()

# Clear history
nexi.clear_history()

# Export conversation
json_data = nexi.export_conversation()

# Import conversation
nexi.import_conversation(json_data)
```

### Utility

```python
# Check if Ollama is available
if nexi.is_available():
    print("Ollama is running!")

# Quick one-shot chat
from nexi import quick_chat
response = quick_chat("What is 2+2?", model="mistral")

# Shutdown (saves state)
nexi.shutdown()
```

## Behavioral Modes

| Mode | Description |
|------|-------------|
| `REACT` | Quick-fire, 1-2 sentences. Snappy replies. |
| `CHAT` | Standard conversation. Balanced depth. |
| `THINK` | Deep mode. Thorough explanations. |
| `OFFLINE` | Internal processing only. |

## Mood States

| Mood | Description |
|------|-------------|
| `NEUTRAL` | Default balanced state |
| `CURIOUS` | Inquisitive, asking questions |
| `PLAYFUL` | Lighthearted, fun |
| `TIRED` | Low energy, brief |
| `FOCUSED` | Concentrated, task-oriented |
| `IRRITATED` | Short, direct |
| `WARM` | Friendly, caring |
| `WITHDRAWN` | Quiet, reflective |
| `EXCITED` | High energy, enthusiastic |

## Memory Types

| Type | Description |
|------|-------------|
| `PREFERENCE` | Things user likes/dislikes |
| `FACT` | Information about user |
| `EVENT` | Something that happened |
| `MILESTONE` | Significant moment |
| `REFLECTION` | Insights or realizations |
| `REQUEST` | Explicitly asked to remember |
| `PATTERN` | Recurring themes |

## Example: Full Conversation

```python
from nexi import Nexi, BehavioralMode, MemoryType

# Initialize
nexi = Nexi()

# Start conversation
print("Starting conversation with Nexi...\n")

# First interaction
r1 = nexi.chat("Hey! I'm working on a Python project today.")
print(f"Nexi: {r1.message}\n")

# Store something
nexi.remember("User is working on a Python project", memory_type=MemoryType.FACT)

# Continue conversation
r2 = nexi.chat("It's a web scraper. Any tips?")
print(f"Nexi: {r2.message}\n")

# Switch to think mode for deeper response
nexi.set_mode(BehavioralMode.THINK)
r3 = nexi.chat("What are the best practices for rate limiting?")
print(f"Nexi: {r3.message}\n")

# Check stats
stats = nexi.get_stats()
print(f"\n--- Stats ---")
print(f"Interactions: {stats.interactions}")
print(f"Memories: {stats.total_memories}")
print(f"Mood: {stats.mood.value}")

# Cleanup
nexi.shutdown()
```

## License

MIT
