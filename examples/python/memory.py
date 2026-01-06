"""
Memory Example - Python

This example shows how to use Nexi's memory system.
Run with: python examples/python/memory.py
"""

import sys
sys.path.insert(0, './python')

from nexi import Nexi, NexiConfig, MemoryType

def main():
    print("🤖 Nexi AI - Memory Example\n")

    config = NexiConfig(data_dir="./example-data-py-memory")
    nexi = Nexi(config)

    # Store different types of memories
    print("📝 Storing memories...\n")

    nexi.remember("User prefers dark mode", memory_type=MemoryType.PREFERENCE, importance=6)
    nexi.remember("User works as a software developer", memory_type=MemoryType.FACT, importance=8)
    nexi.remember("User mentioned they have a cat named Luna", memory_type=MemoryType.FACT, importance=7)
    nexi.remember("Had a great conversation about Python", memory_type=MemoryType.EVENT, importance=5)

    # Search memories
    print('🔍 Searching for "developer":')
    results = nexi.search_memories("developer")
    for memory in results.memories:
        print(f"  - [{memory.type.value}] {memory.content} (importance: {memory.importance})")
    print()

    # Get all memories
    all_memories = nexi.get_all_memories()
    print(f"📚 All memories ({len(all_memories)}):")
    for memory in all_memories:
        print(f"  - [{memory.type.value}] {memory.content}")
    print()

    # Get stats
    stats = nexi.get_stats()
    print("📊 Memory stats:")
    print(f"  Total memories: {stats.total_memories}")
    print(f"  By type: {stats.memories_by_type}")
    print(f"  Average importance: {stats.average_importance:.1f}")
    print()

    # Chat - memories will be used in context
    if nexi.is_available():
        print("💬 Chat (memories will influence response):")
        print("You: Do you remember anything about me?")
        response = nexi.chat("Do you remember anything about me?")
        print(f"Nexi: {response.message}")

    nexi.shutdown()
    print("\n✨ Done!")


if __name__ == "__main__":
    main()
