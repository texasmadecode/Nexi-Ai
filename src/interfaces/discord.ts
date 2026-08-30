import dotenv from 'dotenv';
import { Client, Events, GatewayIntentBits, Message } from 'discord.js';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Nexi } from '../core/nexi.js';
import { OllamaProvider } from '../core/providers/ollama.js';

dotenv.config();

async function promptForValue(question: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function resolveDiscordConfig() {
  let token = process.env.DISCORD_TOKEN?.trim();
  let mode = (process.env.DISCORD_MODE || 'dm').toLowerCase();
  let prefix = process.env.DISCORD_PREFIX || '!nexi';
  let allowedGuild = process.env.DISCORD_ALLOWED_GUILD_ID?.trim();

  if (!token) {
    console.log('No DISCORD_TOKEN was found.');
    token = await promptForValue('Enter your Discord bot token: ');
  }

  if (!['dm', 'guild', 'both'].includes(mode)) {
    console.log(`Unsupported DISCORD_MODE "${mode}". Defaulting to "dm".`);
    mode = 'dm';
  }

  if (!prefix) {
    prefix = '!nexi';
  }

  if (mode !== 'dm' && !allowedGuild) {
    const answer = await promptForValue(
      'Enter the allowed guild ID for guild mode (leave blank for all guilds): '
    );
    allowedGuild = answer || undefined;
  }

  return { token, mode, prefix, allowedGuild };
}

async function getPromptFromMessage(message: Message, prefix: string, mode: string): Promise<string | null> {
  const content = message.content.trim();
  if (!content) return null;

  const isDm = !message.guild;

  if (mode === 'guild' && !message.guild) {
    return null;
  }

  if (mode === 'dm' && message.guild) {
    return content.startsWith(prefix) ? content.slice(prefix.length).trim() : null;
  }

  if (mode === 'both') {
    if (isDm) {
      return content.startsWith(prefix) ? content.slice(prefix.length).trim() : content;
    }

    return content.startsWith(prefix) ? content.slice(prefix.length).trim() : null;
  }

  if (message.guild && content.startsWith(prefix)) {
    return content.slice(prefix.length).trim();
  }

  if (isDm) {
    return content;
  }

  return null;
}

async function createDiscordBot() {
  const { token, mode, prefix, allowedGuild } = await resolveDiscordConfig();
  const provider = OllamaProvider.fromEnv();
  const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const ollamaIsAvailable = await provider.isAvailable();
  console.log('Ollama check:', { host: ollamaHost, available: ollamaIsAvailable });

  if (!ollamaIsAvailable) {
    console.warn('Ollama is not reachable. Start it with "ollama serve" and confirm the host is reachable.');
  }

  const nexi = new Nexi({ dataDir: process.env.NEXI_DATA_DIR || './data' }, provider);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (readyClient: Client<true>) => {
    console.log(`Discord bot ready: ${readyClient.user.tag}`);
    console.log(`Mode: ${mode}`);
    console.log(`Prefix: ${prefix}`);
    if (allowedGuild) console.log(`Allowed guild: ${allowedGuild}`);
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;

    console.log('Discord message received:', {
      author: message.author.tag,
      guild: message.guild?.name ?? 'DM',
      content: message.content,
      mode,
    });

    if (mode === 'guild' && allowedGuild && message.guildId !== allowedGuild) return;
    if (mode === 'guild' && !message.guild) return;
    if (mode === 'dm' && message.guild && !message.content.startsWith(prefix)) return;

    const prompt = await getPromptFromMessage(message, prefix, mode);
    if (!prompt) {
      console.log('Message ignored by mode filter:', { mode, guild: !!message.guild, prefix });
      return;
    }

    console.log('Prompt sent to Nexi:', prompt);

    try {
      const channel = message.channel;
      if ('send' in channel && typeof channel.send === 'function') {
        await channel.send('Thinking...');
        const reply = await nexi.chat(prompt);
        console.log('Nexi reply generated:', { replyLength: reply.length });
        await channel.send(reply);
      }
    } catch (error) {
      console.error('Discord bot error:', error);
      try {
        if ('send' in message.channel && typeof message.channel.send === 'function') {
          await message.channel.send('I hit an error while responding.');
        }
      } catch {
        // ignore channel fallback errors
      }
    }
  });

  client.on(Events.Error, (error: Error) => {
    console.error('Discord client error:', error);
  });

  process.on('SIGINT', async () => {
    nexi.shutdown();
    await client.destroy();
    process.exit(0);
  });

  await client.login(token);
}

createDiscordBot().catch((error: unknown) => {
  console.error('Failed to start Discord bot:', error);

  if (error instanceof Error && error.message.includes('disallowed intents')) {
    console.error('Discord rejected the bot intents. In the Discord Developer Portal, enable the Message Content Intent for this bot.');
    console.error('If you do not want to read message content, remove MessageContent from the intent list and use slash commands instead.');
  }

  process.exit(1);
});

export { createDiscordBot };
