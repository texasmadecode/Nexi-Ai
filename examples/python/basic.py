"""
Basic Nexi AI Usage - Python

This example shows basic usage of the Nexi AI Python client.
Run with: python examples/python/basic.py
"""

import sys
sys.path.insert(0, './python')

from nexi import Nexi, NexiConfig

def main():
    print("🤖 Nexi AI - Basic Example\n")

    # Create Nexi instance with custom config
    config = NexiConfig(
        model="llama3.1:8b",
        data_dir="./example-data-py",
    )
    nexi = Nexi(config)

    # Check if Ollama is available
    if not nexi.is_available():
        print("❌ Ollama is not running. Please start it with: ollama serve")
        return

    print("✅ Connected to Ollama\n")

    # Simple chat
    print("You: Hello!")
    response1 = nexi.chat("Hello!")
    print(f"Nexi: {response1.message}")
    print(f"  (mood: {response1.mood.value}, energy: {response1.energy.value})\n")

    # Another message
    print("You: What do you like to do for fun?")
    response2 = nexi.chat("What do you like to do for fun?")
    print(f"Nexi: {response2.message}\n")

    # Store a memory
    nexi.remember("User is learning to use Nexi AI", importance=8)
    print('📝 Stored memory: "User is learning to use Nexi AI"\n')

    # Get stats
    stats = nexi.get_stats()
    print("📊 Stats:")
    print(f"  Mode: {stats.mode.value}")
    print(f"  Mood: {stats.mood.value}")
    print(f"  Energy: {stats.energy.value}")
    print(f"  Interactions: {stats.interactions}")
    print(f"  Memories: {stats.total_memories}")

    # Cleanup
    nexi.shutdown()
    print("\n✨ Done!")


if __name__ == "__main__":
    main()
