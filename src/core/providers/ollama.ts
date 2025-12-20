// Ollama Provider - Local LLM backend via Ollama HTTP API

import { LLMProvider, LLMProviderConfig, GenerateOptions } from './llm.js';
import { BehavioralMode } from '../../types/index.js';

interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
  options?: { num_predict?: number; temperature?: number };
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

interface OllamaEmbedRequest {
  model: string;
  input: string;
}

interface OllamaEmbedResponse {
  embeddings: number[][];
}

const decoder = new TextDecoder();

export class OllamaProvider implements LLMProvider {
  private readonly config: LLMProviderConfig;
  private readonly generateUrl: string;
  private readonly tagsUrl: string;
  private readonly embedUrl: string;
  private readonly embeddingModel: string;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.generateUrl = config.host + '/api/generate';
    this.tagsUrl = config.host + '/api/tags';
    this.embedUrl = config.host + '/api/embed';
    this.embeddingModel = process.env.NEXI_EMBEDDING_MODEL || 'nomic-embed-text';
  }

  static fromEnv(): OllamaProvider {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const defaultModel = process.env.NEXI_MODEL_DEFAULT || 'llama3.1:8b';

    const modelOverrides: Partial<Record<BehavioralMode, string>> = {};
    const envReact = process.env.NEXI_MODEL_REACT;
    const envChat = process.env.NEXI_MODEL_CHAT;
    const envThink = process.env.NEXI_MODEL_THINK;
    const envOffline = process.env.NEXI_MODEL_OFFLINE;

    if (envReact) modelOverrides.react = envReact;
    if (envChat) modelOverrides.chat = envChat;
    if (envThink) modelOverrides.think = envThink;
    if (envOffline) modelOverrides.offline = envOffline;

    return new OllamaProvider({
      host,
      defaultModel,
      modelOverrides: Object.keys(modelOverrides).length ? modelOverrides : undefined,
    });
  }

  getModelForMode(mode: BehavioralMode): string {
    return this.config.modelOverrides?.[mode] ?? this.config.defaultModel;
  }

  async isAvailable(): Promise<boolean> {
    try {
      return (await fetch(this.tagsUrl)).ok;
    } catch {
      return false;
    }
  }

  async embed(text: string): Promise<number[]> {
    const body: OllamaEmbedRequest = {
      model: this.embeddingModel,
      input: text,
    };

    const res = await fetch(this.embedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error('Ollama embed error: ' + res.status);
    }

    const data = (await res.json()) as OllamaEmbedResponse;
    return data.embeddings[0];
  }

  async generate(prompt: string, opts: GenerateOptions): Promise<string> {
    const useStream = opts.stream ?? true;

    const body: OllamaRequest = {
      model: this.getModelForMode(opts.mode),
      prompt,
      stream: useStream,
      options: { num_predict: opts.maxTokens, temperature: opts.temperature },
    };

    const res = await fetch(this.generateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error('Ollama error: ' + res.status);

    if (useStream && res.body) {
      return this.streamResponse(res.body, opts.onToken);
    }
    return ((await res.json()) as OllamaResponse).response;
  }

  private async streamResponse(
    body: ReadableStream<Uint8Array>,
    onToken?: (t: string) => void
  ): Promise<string> {
    const reader = body.getReader();
    const chunks: string[] = [];
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (!line) continue;

          try {
            const data = JSON.parse(line) as OllamaResponse;
            if (data.response) {
              chunks.push(data.response);
              onToken?.(data.response);
            }
          } catch {
            /* skip */
          }
        }
      }

      if (buffer) {
        try {
          const data = JSON.parse(buffer) as OllamaResponse;
          if (data.response) {
            chunks.push(data.response);
            onToken?.(data.response);
          }
        } catch {
          /* skip */
        }
      }
    } finally {
      reader.releaseLock();
    }

    return chunks.join('');
  }
}
