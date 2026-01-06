#!/usr/bin/env python3
"""
Nexi AI - Terminal Chat

A simple interactive chat interface for Nexi AI.
Run with: python examples/python/chat.py
"""

import sys

# Check for required dependency
try:
    import requests
except ImportError:
    print("❌ Missing required dependency: requests")
    print("   Install with: pip install requests")
    sys.exit(1)

sys.path.insert(0, './python')

from nexi import Nexi, NexiConfig, BehavioralMode, MemoryType


# ANSI colors
class Colors:
    RESET = '\033[0m'
    BRIGHT = '\033[1m'
    DIM = '\033[2m'
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    MAGENTA = '\033[35m'
    RED = '\033[31m'
    BLUE = '\033[34m'


def color(text: str, c: str) -> str:
    return f"{c}{text}{Colors.RESET}"


def print_help():
    print(f"""
{color('Commands:', Colors.BRIGHT)}
  {color('/help', Colors.CYAN)}        - Show this help
  {color('/mode <m>', Colors.CYAN)}    - Set mode (react, chat, think)
  {color('/mood', Colors.CYAN)}        - Show current mood
  {color('/stats', Colors.CYAN)}       - Show stats
  {color('/remember <text>', Colors.CYAN)} - Store a memory
  {color('/search <query>', Colors.CYAN)}  - Search memories
  {color('/clear', Colors.CYAN)}       - Clear conversation history
  {color('/exit', Colors.CYAN)}        - Exit chat
""")


def main():
    print(color('\n╔════════════════════════════════════════╗', Colors.CYAN))
    print(color('║', Colors.CYAN) + color('        🤖 NEXI AI - Terminal Chat       ', Colors.BRIGHT) + color('║', Colors.CYAN))
    print(color('╚════════════════════════════════════════╝', Colors.CYAN))
    print(color('Type /help for commands, /exit to quit\n', Colors.DIM))

    # Create Nexi instance
    config = NexiConfig(data_dir='./nexi-chat-data-py')
    nexi = Nexi(config)

    # Check if Ollama is available
    if not nexi.is_available():
        print(color('❌ Ollama is not running!', Colors.RED))
        print(color('   Start it with: ollama serve', Colors.DIM))
        sys.exit(1)

    print(color('✓ Connected to Ollama\n', Colors.GREEN))

    try:
        while True:
            try:
                user_input = input(color('You: ', Colors.GREEN))
            except EOFError:
                break

            trimmed = user_input.strip()
            if not trimmed:
                continue

            # Handle commands
            if trimmed.startswith('/'):
                parts = trimmed[1:].split(' ', 1)
                cmd = parts[0].lower()
                arg = parts[1] if len(parts) > 1 else ''

                if cmd in ('exit', 'quit', 'q'):
                    print(color('\n👋 Goodbye!\n', Colors.CYAN))
                    break

                elif cmd in ('help', 'h'):
                    print_help()

                elif cmd == 'mode':
                    if arg in ('react', 'chat', 'think'):
                        mode_map = {
                            'react': BehavioralMode.REACT,
                            'chat': BehavioralMode.CHAT,
                            'think': BehavioralMode.THINK,
                        }
                        nexi.set_mode(mode_map[arg])
                        print(color(f'✓ Mode set to: {arg}', Colors.GREEN))
                    else:
                        print(color('Usage: /mode <react|chat|think>', Colors.YELLOW))

                elif cmd == 'mood':
                    state = nexi.get_state()
                    print(color(f'Mood: {state.mood.value} | Energy: {state.energy.value}', Colors.MAGENTA))

                elif cmd == 'stats':
                    stats = nexi.get_stats()
                    print(color('\n📊 Stats:', Colors.CYAN))
                    print(f'  Mode: {stats.mode.value}')
                    print(f'  Mood: {stats.mood.value}')
                    print(f'  Energy: {stats.energy.value}')
                    print(f'  Interactions: {stats.interactions}')
                    print(f'  Memories: {stats.total_memories}')
                    if stats.total_memories > 0:
                        print(f'  Avg Importance: {stats.average_importance:.1f}')
                    print()

                elif cmd == 'remember':
                    if arg:
                        nexi.remember(arg)
                        print(color(f'✓ Remembered: "{arg}"', Colors.GREEN))
                    else:
                        print(color('Usage: /remember <text to remember>', Colors.YELLOW))

                elif cmd == 'search':
                    if arg:
                        results = nexi.search_memories(arg)
                        if results.count > 0:
                            print(color(f'\n🔍 Found {results.count} memories:', Colors.CYAN))
                            for m in results.memories:
                                print(f'  - [{m.type.value}] {m.content}')
                            print()
                        else:
                            print(color('No memories found.', Colors.DIM))
                    else:
                        print(color('Usage: /search <query>', Colors.YELLOW))

                elif cmd == 'clear':
                    nexi.clear_history()
                    print(color('✓ Conversation cleared', Colors.GREEN))

                else:
                    print(color(f'Unknown command: /{cmd}. Type /help for commands.', Colors.YELLOW))

                continue

            # Regular chat - stream response
            print(color('Nexi: ', Colors.CYAN), end='', flush=True)

            try:
                def on_token(token: str):
                    print(token, end='', flush=True)

                nexi.chat_stream(trimmed, on_token=on_token)
                print('\n')
            except Exception as e:
                print(color(f'\n❌ Error: {e}', Colors.RED))

    except KeyboardInterrupt:
        print(color('\n\n👋 Goodbye!\n', Colors.CYAN))
    finally:
        nexi.shutdown()


if __name__ == '__main__':
    main()
