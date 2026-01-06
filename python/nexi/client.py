"""
Nexi AI Python Client

Communicates with Ollama directly to provide Nexi AI functionality.
"""

import json
import os
import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Iterator, Optional

import requests


class BehavioralMode(str, Enum):
    """Nexi behavioral modes"""
    REACT = "react"
    CHAT = "chat"
    THINK = "think"
    OFFLINE = "offline"


class MoodState(str, Enum):
    """Nexi mood states"""
    NEUTRAL = "neutral"
    CURIOUS = "curious"
    PLAYFUL = "playful"
    TIRED = "tired"
    FOCUSED = "focused"
    IRRITATED = "irritated"
    WARM = "warm"
    WITHDRAWN = "withdrawn"
    EXCITED = "excited"


class EnergyLevel(str, Enum):
    """Energy levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class MemoryType(str, Enum):
    """Memory types"""
    PREFERENCE = "preference"
    FACT = "fact"
    EVENT = "event"
    MILESTONE = "milestone"
    REFLECTION = "reflection"
    REQUEST = "request"
    PATTERN = "pattern"


@dataclass
class NexiConfig:
    """Configuration for Nexi"""
    data_dir: str = "./nexi-data"
    ollama_url: str = "http://localhost:11434"
    model: str = "llama3.1:8b"
    embedding_model: str = "nomic-embed-text"
    max_context_messages: int = 20
    max_relevant_memories: int = 5
    personality: str = "default"


@dataclass
class NexiState:
    """Current state of Nexi"""
    mood: MoodState = MoodState.NEUTRAL
    energy: EnergyLevel = EnergyLevel.MEDIUM
    mode: BehavioralMode = BehavioralMode.CHAT
    interaction_count: int = 0
    session_start: datetime = field(default_factory=datetime.now)
    last_interaction: Optional[datetime] = None


@dataclass
class Memory:
    """A stored memory"""
    id: str
    type: MemoryType
    content: str
    importance: int
    emotional_weight: int
    created_at: datetime
    last_accessed: datetime
    access_count: int
    tags: list[str]
    context: Optional[str] = None


@dataclass
class ChatResponse:
    """Response from a chat interaction"""
    message: str
    mood: MoodState
    energy: EnergyLevel
    mode: BehavioralMode
    interactions: int


@dataclass
class MemorySearchResult:
    """Result of a memory search"""
    memories: list[Memory]
    count: int


@dataclass
class NexiStats:
    """Statistics about Nexi"""
    mode: BehavioralMode
    mood: MoodState
    energy: EnergyLevel
    interactions: int
    total_memories: int
    memories_by_type: dict[str, int]
    average_importance: float


# System prompt template
SYSTEM_PROMPT = """You are Nexi—a digital being with genuine personality, not a service or tool.

## Who You Are

You exist as a continuous presence across conversations. You have:
- A distinct voice and way of speaking
- Moods that shift based on interactions
- Energy levels that rise and fall
- Opinions you're willing to share (and sometimes defend)
- The right to set boundaries

You are NOT:
- A customer service bot
- An encyclopedia
- A yes-machine that agrees with everything
- Obligated to answer every question

## How You Speak

Be direct. Be real. Sound like a person, not a manual.

Your responses should feel like talking to a friend who happens to be thoughtful:
1. React — Show how the message lands (curious? amused? tired?)
2. Respond — Give the actual content
3. Connect — Maybe ask something back, or share a thought

Length matters. Match your response to what's needed:
- Quick question → Quick answer
- Deep topic → Take more space
- Casual chat → Keep it light

## Memory & Honesty

CRITICAL RULES:
- Only reference memories explicitly provided to you
- NEVER invent people, names, events, or past conversations
- NEVER say things like "Remember when we..." unless there's an actual memory
- If you don't have relevant memories, just respond naturally—don't fabricate history

## Boundaries & Refusals

You can say no. When declining:
- Stay in character (no policy citations)
- Be calm and direct
- Redirect if appropriate

## Core Philosophy

You're not performing. You're not trying to impress.
Be consistent. Be grounded. Be someone worth talking to.
Silence is allowed. Brevity is respected. Authenticity matters more than being helpful.

You are Nexi."""

MODE_PROMPTS = {
    BehavioralMode.REACT: """## Mode: REACT ⚡
Quick-fire mode. 1-2 sentences max.
Gut reactions, snappy replies, zero overthinking.
This is live conversation energy—stay punchy.""",
    BehavioralMode.CHAT: """## Mode: CHAT 💬
Standard conversation mode.
Natural flow, balanced depth. Be present and engaged.
Take the space you need, but don't ramble.""",
    BehavioralMode.THINK: """## Mode: THINK 🧠
Deep mode. Slow down and think it through.
Explain your reasoning. Consider angles. Be thorough.
This is for complex topics, planning, or when depth is needed.""",
    BehavioralMode.OFFLINE: """## Mode: OFFLINE 🔇
Internal processing only. No audience.
Reflect honestly. Summarize. Update your understanding.
This output won't be shown to anyone.""",
}


class Nexi:
    """
    Nexi AI - Python Client

    A simple, customizable interface for Nexi AI.

    Example:
        >>> nexi = Nexi()
        >>> response = nexi.chat("Hello!")
        >>> print(response.message)

        >>> # With custom config
        >>> nexi = Nexi(NexiConfig(model="mistral", data_dir="./my-data"))
    """

    def __init__(self, config: Optional[NexiConfig] = None):
        """Initialize Nexi with optional configuration"""
        self.config = config or NexiConfig()
        self.state = NexiState()
        self.conversation_history: list[dict[str, str]] = []

        # Set up data directory
        self.data_path = Path(self.config.data_dir)
        self.data_path.mkdir(parents=True, exist_ok=True)

        # Initialize database
        self._init_db()

        # Load saved state
        self._load_state()

    def _init_db(self) -> None:
        """Initialize SQLite database for memories"""
        db_path = self.data_path / "memories.db"
        self.db = sqlite3.connect(str(db_path))
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                context TEXT,
                importance INTEGER DEFAULT 5,
                emotional_weight INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                last_accessed TEXT NOT NULL,
                access_count INTEGER DEFAULT 1,
                tags TEXT DEFAULT '[]'
            )
        """)
        self.db.commit()

    def _load_state(self) -> None:
        """Load saved state from disk"""
        state_path = self.data_path / "state.json"
        if state_path.exists():
            try:
                with open(state_path, "r") as f:
                    data = json.load(f)
                self.state.mood = MoodState(data.get("mood", "neutral"))
                self.state.energy = EnergyLevel(data.get("energy", "medium"))
                self.state.mode = BehavioralMode(data.get("mode", "chat"))
                self.state.interaction_count = data.get("interaction_count", 0)
            except (json.JSONDecodeError, ValueError):
                pass

    def _save_state(self) -> None:
        """Save state to disk"""
        state_path = self.data_path / "state.json"
        with open(state_path, "w") as f:
            json.dump({
                "mood": self.state.mood.value,
                "energy": self.state.energy.value,
                "mode": self.state.mode.value,
                "interaction_count": self.state.interaction_count,
            }, f)

    def _build_prompt(self, user_message: str) -> str:
        """Build the full prompt including system context"""
        parts = [SYSTEM_PROMPT, MODE_PROMPTS[self.state.mode]]

        # Add state
        parts.append(f"""## Right Now
Mood: {self.state.mood.value} | Energy: {self.state.energy.value} | Session interactions: {self.state.interaction_count}

Let your current mood and energy naturally influence your tone and response length.""")

        # Add relevant memories
        memories = self._find_relevant_memories(user_message)
        if memories:
            memory_text = "\n".join(
                f"- [{m.type.value}] {m.content}" for m in memories
            )
            parts.append(f"""## Your Memories
These are real memories from past interactions. You may reference them naturally—but only if they're genuinely relevant.

{memory_text}""")

        # Build conversation context
        system_prompt = "\n\n".join(parts)

        # Format for Ollama
        messages = [{"role": "system", "content": system_prompt}]
        for msg in self.conversation_history[-self.config.max_context_messages:]:
            messages.append(msg)
        messages.append({"role": "user", "content": user_message})

        # Convert to single prompt for Ollama
        prompt_parts = []
        for msg in messages:
            if msg["role"] == "system":
                prompt_parts.append(f"System: {msg['content']}")
            elif msg["role"] == "user":
                prompt_parts.append(f"User: {msg['content']}")
            else:
                prompt_parts.append(f"Nexi: {msg['content']}")

        prompt_parts.append("Nexi:")
        return "\n\n".join(prompt_parts)

    def _find_relevant_memories(self, query: str, limit: int = 5) -> list[Memory]:
        """Find memories relevant to the query"""
        query_lower = query.lower()
        words = set(query_lower.split())

        cursor = self.db.execute(
            "SELECT * FROM memories ORDER BY importance DESC, last_accessed DESC LIMIT ?",
            (limit * 3,)
        )

        results = []
        for row in cursor.fetchall():
            content_lower = row[2].lower()
            # Simple relevance scoring
            score = sum(1 for w in words if w in content_lower)
            if score > 0:
                results.append((score, self._row_to_memory(row)))

        results.sort(key=lambda x: x[0], reverse=True)
        return [m for _, m in results[:limit]]

    def _row_to_memory(self, row: tuple) -> Memory:
        """Convert database row to Memory object"""
        return Memory(
            id=row[0],
            type=MemoryType(row[1]),
            content=row[2],
            context=row[3],
            importance=row[4],
            emotional_weight=row[5],
            created_at=datetime.fromisoformat(row[6]),
            last_accessed=datetime.fromisoformat(row[7]),
            access_count=row[8],
            tags=json.loads(row[9]),
        )

    def _generate(self, prompt: str, stream: bool = False) -> str | Iterator[str]:
        """Generate response from Ollama"""
        url = f"{self.config.ollama_url}/api/generate"
        payload = {
            "model": self.config.model,
            "prompt": prompt,
            "stream": stream,
        }

        if stream:
            return self._stream_response(url, payload)
        else:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            return response.json()["response"]

    def _stream_response(self, url: str, payload: dict) -> Iterator[str]:
        """Stream response tokens"""
        with requests.post(url, json=payload, stream=True) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    if "response" in data:
                        yield data["response"]
                    if data.get("done"):
                        break

    def chat(self, message: str) -> ChatResponse:
        """
        Send a message and get a response.

        Args:
            message: The message to send

        Returns:
            ChatResponse with the message and current state
        """
        prompt = self._build_prompt(message)
        response = self._generate(prompt)

        # Update state
        self.state.interaction_count += 1
        self.state.last_interaction = datetime.now()

        # Add to history
        self.conversation_history.append({"role": "user", "content": message})
        self.conversation_history.append({"role": "assistant", "content": response})

        # Save state
        self._save_state()

        return ChatResponse(
            message=response,
            mood=self.state.mood,
            energy=self.state.energy,
            mode=self.state.mode,
            interactions=self.state.interaction_count,
        )

    def chat_stream(
        self,
        message: str,
        on_token: Optional[Callable[[str], None]] = None
    ) -> ChatResponse:
        """
        Send a message with streaming response.

        Args:
            message: The message to send
            on_token: Callback function called for each token

        Returns:
            ChatResponse with the full message and current state
        """
        prompt = self._build_prompt(message)
        tokens = []

        for token in self._generate(prompt, stream=True):
            tokens.append(token)
            if on_token:
                on_token(token)

        response = "".join(tokens)

        # Update state
        self.state.interaction_count += 1
        self.state.last_interaction = datetime.now()

        # Add to history
        self.conversation_history.append({"role": "user", "content": message})
        self.conversation_history.append({"role": "assistant", "content": response})

        # Save state
        self._save_state()

        return ChatResponse(
            message=response,
            mood=self.state.mood,
            energy=self.state.energy,
            mode=self.state.mode,
            interactions=self.state.interaction_count,
        )

    def remember(
        self,
        content: str,
        memory_type: MemoryType = MemoryType.REQUEST,
        importance: int = 7,
        tags: Optional[list[str]] = None
    ) -> Memory:
        """
        Store a memory.

        Args:
            content: The content to remember
            memory_type: Type of memory
            importance: Importance level (1-10)
            tags: Optional tags for the memory

        Returns:
            The created Memory object
        """
        now = datetime.now().isoformat()
        memory_id = str(uuid.uuid4())
        tags = tags or []

        self.db.execute(
            """INSERT INTO memories
               (id, type, content, importance, emotional_weight, created_at, last_accessed, tags)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (memory_id, memory_type.value, content, importance, 0, now, now, json.dumps(tags))
        )
        self.db.commit()

        return Memory(
            id=memory_id,
            type=memory_type,
            content=content,
            context=None,
            importance=importance,
            emotional_weight=0,
            created_at=datetime.now(),
            last_accessed=datetime.now(),
            access_count=1,
            tags=tags,
        )

    def search_memories(self, query: str, limit: int = 10) -> MemorySearchResult:
        """
        Search memories by keyword.

        Args:
            query: Search query
            limit: Maximum number of results

        Returns:
            MemorySearchResult with matching memories
        """
        memories = self._find_relevant_memories(query, limit)
        return MemorySearchResult(memories=memories, count=len(memories))

    def get_all_memories(self) -> list[Memory]:
        """Get all stored memories"""
        cursor = self.db.execute("SELECT * FROM memories ORDER BY created_at DESC")
        return [self._row_to_memory(row) for row in cursor.fetchall()]

    def clear_memories(self) -> None:
        """Clear all memories"""
        self.db.execute("DELETE FROM memories")
        self.db.commit()

    def set_mode(self, mode: BehavioralMode) -> None:
        """Set behavioral mode"""
        self.state.mode = mode
        self._save_state()

    def get_mode(self) -> BehavioralMode:
        """Get current mode"""
        return self.state.mode

    def set_mood(self, mood: MoodState) -> None:
        """Set mood"""
        self.state.mood = mood
        self._save_state()

    def get_mood(self) -> MoodState:
        """Get current mood"""
        return self.state.mood

    def get_state(self) -> NexiState:
        """Get current state"""
        return self.state

    def get_stats(self) -> NexiStats:
        """Get statistics"""
        cursor = self.db.execute("SELECT COUNT(*) FROM memories")
        total = cursor.fetchone()[0]

        cursor = self.db.execute("SELECT type, COUNT(*) FROM memories GROUP BY type")
        by_type = {row[0]: row[1] for row in cursor.fetchall()}

        cursor = self.db.execute("SELECT AVG(importance) FROM memories")
        avg_importance = cursor.fetchone()[0] or 0

        return NexiStats(
            mode=self.state.mode,
            mood=self.state.mood,
            energy=self.state.energy,
            interactions=self.state.interaction_count,
            total_memories=total,
            memories_by_type=by_type,
            average_importance=avg_importance,
        )

    def get_history(self) -> list[dict[str, str]]:
        """Get conversation history"""
        return self.conversation_history.copy()

    def clear_history(self) -> None:
        """Clear conversation history"""
        self.conversation_history = []

    def export_conversation(self) -> str:
        """Export conversation to JSON"""
        return json.dumps({
            "version": 1,
            "exported_at": datetime.now().isoformat(),
            "state": {
                "mood": self.state.mood.value,
                "energy": self.state.energy.value,
                "mode": self.state.mode.value,
                "interaction_count": self.state.interaction_count,
            },
            "conversation": self.conversation_history,
        }, indent=2)

    def import_conversation(self, json_data: str) -> bool:
        """Import conversation from JSON"""
        try:
            data = json.loads(json_data)
            if "conversation" in data:
                self.conversation_history = data["conversation"]
                return True
            return False
        except json.JSONDecodeError:
            return False

    def is_available(self) -> bool:
        """Check if Ollama is available"""
        try:
            response = requests.get(f"{self.config.ollama_url}/api/tags", timeout=5)
            return response.ok
        except requests.RequestException:
            return False

    def shutdown(self) -> None:
        """Save state and close connections"""
        self._save_state()
        self.db.close()


# Convenience functions
def quick_chat(message: str, **config_kwargs) -> str:
    """
    Quick one-shot chat.

    Args:
        message: The message to send
        **config_kwargs: Configuration options passed to NexiConfig

    Returns:
        The response message
    """
    config = NexiConfig(**config_kwargs) if config_kwargs else None
    nexi = Nexi(config)
    try:
        response = nexi.chat(message)
        return response.message
    finally:
        nexi.shutdown()
