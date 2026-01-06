"""
Nexi AI - Python Client Library

A simple Python interface for interacting with Nexi AI running via Ollama.

Usage:
    from nexi import Nexi

    nexi = Nexi()
    response = nexi.chat("Hello!")
    print(response.message)
"""

from .client import (
    Nexi,
    NexiConfig,
    ChatResponse,
    NexiState,
    Memory,
    MemorySearchResult,
    NexiStats,
    BehavioralMode,
    MoodState,
    EnergyLevel,
    MemoryType,
    quick_chat,
)

__version__ = "0.2.0"
__all__ = [
    "Nexi",
    "NexiConfig",
    "ChatResponse",
    "NexiState",
    "Memory",
    "MemorySearchResult",
    "NexiStats",
    "BehavioralMode",
    "MoodState",
    "EnergyLevel",
    "MemoryType",
    "quick_chat",
]
