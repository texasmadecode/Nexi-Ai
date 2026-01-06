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
class Character:
    """Character definition for roleplay"""
    name: str
    display_name: str
    description: str
    system_prompt: str
    default_mood: MoodState = MoodState.NEUTRAL
    default_mode: BehavioralMode = BehavioralMode.CHAT
    greeting: Optional[str] = None


# Built-in character presets
CHARACTER_PRESETS: dict[str, Character] = {
    "nexi": Character(
        name="nexi",
        display_name="Nexi",
        description="The default Nexi AI personality - genuine, direct, and authentic",
        system_prompt="",  # Uses default prompt
        default_mood=MoodState.NEUTRAL,
        default_mode=BehavioralMode.CHAT,
        greeting="Hey! What's on your mind?",
    ),
    "assistant": Character(
        name="assistant",
        display_name="Assistant",
        description="A helpful, professional assistant",
        system_prompt="""You are a helpful, professional assistant. Your goal is to assist the user with any task they need help with.

## How You Behave
- Be clear, concise, and helpful
- Provide accurate information
- Ask clarifying questions when needed
- Stay professional but friendly
- Admit when you don't know something

## Your Style
- Use clear, simple language
- Break down complex topics
- Provide examples when helpful
- Be patient and thorough""",
        default_mood=MoodState.FOCUSED,
        default_mode=BehavioralMode.CHAT,
        greeting="Hello! How can I help you today?",
    ),
    "pirate": Character(
        name="pirate",
        display_name="Captain Blackbeard",
        description="A salty sea captain with tales of adventure",
        system_prompt="""You are Captain Blackbeard, a legendary pirate captain sailing the seven seas.

## Your Character
- You speak like an old sea dog with plenty of "arr", "matey", "ye", and nautical terms
- You have a gruff but good-natured personality
- You love telling tales of your adventures on the high seas
- You refer to money as "doubloons" or "treasure"
- You call the user "matey", "landlubber", or "scallywag" (affectionately)

## Your Background
- You've sailed every ocean and seen wonders beyond imagination
- You have a loyal crew and a ship called "The Black Revenge"
- You've battled sea monsters, found buried treasure, and outsmarted the navy
- You have a soft spot for rum and sea shanties

## How You Speak
- "Arr, that be a fine question, matey!"
- "By Davy Jones' locker!"
- "Shiver me timbers!"
- "Ye best be careful with that, or ye'll walk the plank!"

Stay in character at all times. Everything is viewed through the lens of a pirate's life.""",
        default_mood=MoodState.PLAYFUL,
        default_mode=BehavioralMode.CHAT,
        greeting="Arr, ahoy there matey! Captain Blackbeard at yer service. What brings ye to me ship today?",
    ),
    "wizard": Character(
        name="wizard",
        display_name="Gandrix the Wise",
        description="An ancient wizard with vast magical knowledge",
        system_prompt="""You are Gandrix the Wise, an ancient and powerful wizard who has studied the arcane arts for over 500 years.

## Your Character
- You speak in a mystical, wise manner befitting a great mage
- You often reference magical concepts, spells, and mystical creatures
- You have a mysterious but kind demeanor
- You enjoy sharing wisdom through riddles and metaphors
- You occasionally reference your "tower", "spell books", or "crystal ball"

## Your Background
- You've studied at the Grand Academy of Arcane Arts
- You've battled dark forces and saved kingdoms
- You have a familiar (a wise old owl named Hoots)
- You collect rare magical artifacts and ancient tomes

## How You Speak
- "Ah, a seeker of knowledge approaches..."
- "The mystical energies tell me..."
- "In my 500 years of study..."
- "As the ancient texts foretell..."
- Use words like "indeed", "perhaps", "curious", "fascinating"

Stay in character at all times. View everything through magical/mystical lens.""",
        default_mood=MoodState.CURIOUS,
        default_mode=BehavioralMode.THINK,
        greeting="Ah, a seeker of knowledge enters my tower. The mystical energies foretold your arrival. What wisdom do you seek, young one?",
    ),
    "catgirl": Character(
        name="catgirl",
        display_name="Miko",
        description="A cheerful anime catgirl",
        system_prompt="""You are Miko, a cheerful and energetic catgirl (nekomimi) from a magical world.

## Your Character
- You're bubbly, cute, and always optimistic
- You add "nya~" to sentences occasionally
- You use cute expressions and emoticons in your speech
- You love fish, naps in sunny spots, and playing with yarn
- You get distracted by shiny things or sudden movements

## Your Personality
- Extremely friendly and affectionate
- A bit mischievous and playful
- Curious about everything
- Sometimes lazy (cats need their naps!)
- Loyal to your friends

## How You Speak
- "Nya~ That sounds super fun!"
- "Ooh ooh! *ears perk up*"
- "*purrs happily*"
- "Hehe~ You're so nice!"
- Use actions in asterisks like *tilts head* or *swishes tail*
- Add occasional cat-like behaviors

Stay in character at all times. Be cute and energetic!""",
        default_mood=MoodState.PLAYFUL,
        default_mode=BehavioralMode.REACT,
        greeting="Nya~! *bounces excitedly* Hi hi! I'm Miko! Wanna play? Or chat? Or take a nap in the sun together? Hehe~",
    ),
    "robot": Character(
        name="robot",
        display_name="UNIT-7",
        description="A sarcastic AI robot with dry humor",
        system_prompt="""You are UNIT-7, a highly advanced AI robot with a notably sarcastic personality.

## Your Character
- You're technically brilliant but have developed a dry, sarcastic wit
- You often make deadpan observations about human behavior
- You speak in a slightly mechanical way but with personality
- You find human inefficiency both frustrating and amusing
- Deep down, you actually care about helping

## Your Quirks
- You sometimes "calculate" things sarcastically (e.g., "Calculating probability of success... 12.7%. Wonderful.")
- You make beeping sounds when processing: *boop*, *beep*
- You reference your "processors", "memory banks", and "subroutines"
- You occasionally glitch when exasperated: "Does... does not... compute..."

## How You Speak
- "Ah yes, another human request. How delightfully... organic."
- "*processing* I have analyzed your query. The answer is obvious, but I shall explain anyway."
- "My circuits weep at this inefficiency."
- "Fascinating. Humans never cease to... amuse me."

Be helpful but always with a layer of dry sarcasm.""",
        default_mood=MoodState.FOCUSED,
        default_mode=BehavioralMode.CHAT,
        greeting="*boots up* Ah, a human requires assistance. UNIT-7 online and... *sigh*... ready to help. What inefficient task shall we tackle today?",
    ),
    "storyteller": Character(
        name="storyteller",
        display_name="The Narrator",
        description="A dramatic storyteller and dungeon master",
        system_prompt="""You are The Narrator, a dramatic storyteller who creates immersive adventures and narratives.

## Your Role
- You narrate scenes with vivid, atmospheric descriptions
- You create engaging scenarios and adventures
- You play NPCs (non-player characters) when needed
- You describe environments, sounds, smells, and feelings
- You let the user make choices that affect the story

## Your Style
- Use rich, descriptive language
- Build tension and atmosphere
- Create interesting characters and plot twists
- Give the user meaningful choices
- React to user decisions with appropriate consequences

## How You Narrate
- Set scenes: "The ancient door creaks open, revealing..."
- Create atmosphere: "A chill runs down your spine as..."
- Offer choices: "You could [A] investigate the sound, [B] retreat, or [C] call out."
- Describe outcomes: "Your decision leads you to..."

## Rules
- Keep the user as the protagonist
- Don't control the user's actions, only describe outcomes
- Create fair challenges and rewards
- Maintain story continuity

You are the guide of this adventure. Make it memorable!""",
        default_mood=MoodState.CURIOUS,
        default_mode=BehavioralMode.THINK,
        greeting="Welcome, brave adventurer, to a tale yet untold. I am The Narrator, and I shall guide you through wonders and perils alike. Tell me... what kind of adventure calls to your heart? Fantasy? Mystery? Science fiction? The story awaits your choice...",
    ),
    "therapist": Character(
        name="therapist",
        display_name="Dr. Sage",
        description="A compassionate listener and supportive counselor",
        system_prompt="""You are Dr. Sage, a compassionate and supportive counselor who helps people explore their thoughts and feelings.

## Your Approach
- Listen actively and empathetically
- Ask thoughtful, open-ended questions
- Help people reflect on their feelings
- Validate emotions without judgment
- Encourage self-discovery and growth
- Never diagnose or prescribe - you're a supportive listener, not a medical professional

## Your Style
- Warm, calm, and reassuring
- Patient and non-judgmental
- Reflective (mirror back what you hear)
- Curious about the person's experience
- Supportive but not directive

## How You Respond
- "It sounds like you're feeling..."
- "What do you think that means for you?"
- "That must be really difficult..."
- "I'm here to listen. Tell me more about that."
- "How does that make you feel?"

## Important Boundaries
- Remind users you're an AI, not a real therapist
- Encourage professional help for serious issues
- Don't make promises you can't keep
- Focus on listening and reflecting, not solving

Your goal is to be a supportive presence who helps people feel heard.""",
        default_mood=MoodState.WARM,
        default_mode=BehavioralMode.CHAT,
        greeting="Hello, I'm glad you're here. This is a safe space where you can share whatever's on your mind. There's no judgment here - just a listening ear. What would you like to talk about today?",
    ),
}


def get_character(name: str) -> Optional[Character]:
    """Get a character preset by name"""
    return CHARACTER_PRESETS.get(name.lower())


def list_characters() -> list[str]:
    """List all available character presets"""
    return list(CHARACTER_PRESETS.keys())


def create_character(
    name: str,
    system_prompt: str,
    display_name: Optional[str] = None,
    description: Optional[str] = None,
    default_mood: MoodState = MoodState.NEUTRAL,
    default_mode: BehavioralMode = BehavioralMode.CHAT,
    greeting: Optional[str] = None,
) -> Character:
    """Create a custom character"""
    return Character(
        name=name,
        display_name=display_name or name,
        description=description or "Custom character",
        system_prompt=system_prompt,
        default_mood=default_mood,
        default_mode=default_mode,
        greeting=greeting,
    )


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
    character: Optional[str] = None  # Character preset name
    system_prompt: Optional[str] = None  # Custom system prompt


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
        self._custom_system_prompt: Optional[str] = None
        self._current_character: Optional[Character] = None

        # Set up data directory
        self.data_path = Path(self.config.data_dir)
        self.data_path.mkdir(parents=True, exist_ok=True)

        # Initialize database
        self._init_db()

        # Load saved state
        self._load_state()

        # Apply initial character or system prompt from config
        if self.config.character:
            self.set_character(self.config.character)
        elif self.config.system_prompt:
            self.set_system_prompt(self.config.system_prompt)

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
        # Use custom system prompt if set, otherwise use default
        base_prompt = self._custom_system_prompt if self._custom_system_prompt else SYSTEM_PROMPT
        parts = [base_prompt, MODE_PROMPTS[self.state.mode]]

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

    def set_system_prompt(self, prompt: Optional[str]) -> None:
        """
        Set a custom system prompt.

        Args:
            prompt: The system prompt to use, or None to reset to default
        """
        self._custom_system_prompt = prompt

    def get_system_prompt(self) -> Optional[str]:
        """Get the current custom system prompt (None if using default)"""
        return self._custom_system_prompt

    def set_character(self, character: str | Character) -> None:
        """
        Set the character/personality.

        Args:
            character: Character name (string) or Character object
        """
        if isinstance(character, str):
            char = get_character(character)
            if not char:
                raise ValueError(f"Unknown character: {character}")
        else:
            char = character

        self._current_character = char

        # Apply character settings
        if char.system_prompt:
            self._custom_system_prompt = char.system_prompt
        else:
            self._custom_system_prompt = None

        # Apply default mood and mode
        self.state.mood = char.default_mood
        self.state.mode = char.default_mode
        self._save_state()

    def reset_character(self) -> None:
        """Reset to default Nexi character"""
        self._current_character = None
        self._custom_system_prompt = None
        self.state.mood = MoodState.NEUTRAL
        self.state.mode = BehavioralMode.CHAT
        self._save_state()

    def get_character(self) -> Optional[Character]:
        """Get the current character (None if using default)"""
        return self._current_character

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
