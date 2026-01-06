"""
Streaming Example - Python

This example shows how to use streaming responses.
Run with: python examples/python/streaming.py
"""

import sys
sys.path.insert(0, './python')

from nexi import Nexi, NexiConfig, BehavioralMode

def main():
    print("🤖 Nexi AI - Streaming Example\n")

    config = NexiConfig(
        model="llama3.1:8b",
        data_dir="./example-data-py-stream",
    )
    nexi = Nexi(config)

    # Check availability
    if not nexi.is_available():
        print("❌ Ollama is not running")
        return

    # Set to think mode for a longer response
    nexi.set_mode(BehavioralMode.THINK)

    print("You: Tell me about the history of artificial intelligence.\n")
    print("Nexi: ", end="", flush=True)

    # Stream the response
    def on_token(token: str):
        print(token, end="", flush=True)

    response = nexi.chat_stream(
        "Tell me about the history of artificial intelligence.",
        on_token=on_token
    )

    print("\n")
    print(f"\n📊 Response stats:")
    print(f"  Total length: {len(response.message)} characters")
    print(f"  Mood: {response.mood.value}")
    print(f"  Mode: {response.mode.value}")

    nexi.shutdown()


if __name__ == "__main__":
    main()
