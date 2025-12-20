import { describe, it, expect, beforeEach } from 'vitest';
import { SentimentAnalyzer } from '../src/core/sentiment.js';
import { LLMProvider, GenerateOptions } from '../src/core/providers/llm.js';

class MockSentimentProvider implements LLMProvider {
  async generate(_prompt: string, _opts: GenerateOptions): Promise<string> {
    return '{"mood":"warm","energy":"up","confidence":0.8}';
  }

  async embed(text: string): Promise<number[]> {
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 384 }, (_, i) => Math.sin(hash + i) * 0.5);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getModelForMode(): string {
    return 'mock-model';
  }
}

describe('SentimentAnalyzer', () => {
  let analyzer: SentimentAnalyzer;

  beforeEach(() => {
    analyzer = new SentimentAnalyzer();
  });

  describe('rule-based analysis', () => {
    it('should detect warm mood from thankful messages', () => {
      const result = analyzer.analyzeRuleBased('Thank you so much!');

      expect(result.mood).toBe('warm');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect curious mood from questions', () => {
      const result = analyzer.analyzeRuleBased('I wonder how this works??');

      expect(result.mood).toBe('curious');
    });

    it('should detect playful mood from laughing', () => {
      const result = analyzer.analyzeRuleBased('haha that was so funny lol');

      expect(result.mood).toBe('playful');
    });

    it('should detect excited mood from enthusiasm', () => {
      const result = analyzer.analyzeRuleBased("I'm so excited! This is amazing!");

      expect(result.mood).toBe('excited');
      expect(result.energy).toBe('up');
    });

    it('should detect focused mood from frustration', () => {
      const result = analyzer.analyzeRuleBased('This is so frustrating and annoying');

      expect(result.mood).toBe('focused');
    });

    it('should detect tired mood', () => {
      const result = analyzer.analyzeRuleBased("I'm so tired and exhausted today");

      expect(result.mood).toBe('tired');
    });

    it('should return neutral for plain messages', () => {
      const result = analyzer.analyzeRuleBased('Okay sure');

      expect(result.mood).toBe('neutral');
    });

    it('should detect energy up from exclamation marks', () => {
      const result = analyzer.analyzeRuleBased('This is great! Amazing! Awesome!');

      expect(result.energy).toBe('up');
    });

    it('should detect energy down from bored messages', () => {
      const result = analyzer.analyzeRuleBased("I'm bored... meh... whatever");

      expect(result.energy).toBe('down');
    });
  });

  describe('LLM-based analysis', () => {
    it('should use LLM when provider is set', async () => {
      const provider = new MockSentimentProvider();
      analyzer.setProvider(provider);

      const result = await analyzer.analyze('Test message');

      expect(result.mood).toBe('warm');
      expect(result.energy).toBe('up');
      expect(result.confidence).toBe(0.8);
    });

    it('should fall back to rule-based when no provider', async () => {
      const result = await analyzer.analyze('Thank you!');

      expect(result.mood).toBe('warm');
    });
  });
});
