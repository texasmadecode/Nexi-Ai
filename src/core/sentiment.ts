// Nexi Sentiment Analysis - Mood detection from user input

import { LLMProvider } from './providers/llm.js';
import { MoodState } from '../types/index.js';

export interface SentimentResult {
  mood: MoodState | 'neutral';
  energy: 'up' | 'down' | 'neutral';
  confidence: number;
}

// Word patterns for rule-based analysis
const MOOD_PATTERNS: Record<MoodState, RegExp[]> = {
  curious: [/\?{2,}/, /wonder/i, /curious/i, /how does/i, /what if/i, /why/i],
  playful: [/lol/i, /haha/i, /😂/, /🤣/, /joke/i, /funny/i, /tease/i],
  focused: [/serious/i, /important/i, /need to/i, /must/i, /critical/i],
  warm: [/thank/i, /love/i, /appreciate/i, /❤️/, /🥰/, /sweet/i, /kind/i],
  reflective: [/think about/i, /reflect/i, /remember when/i, /used to/i, /past/i],
  tired: [/tired/i, /exhausted/i, /sleepy/i, /worn out/i, /😴/],
  excited: [/excited/i, /amazing/i, /awesome/i, /can't wait/i, /🎉/, /!/],
  neutral: [],
};

const ENERGY_PATTERNS = {
  up: [/!/g, /excited/i, /amazing/i, /love/i, /great/i, /awesome/i],
  down: [/tired/i, /bored/i, /meh/i, /sigh/i, /whatever/i, /..../],
};

const NEGATIVE_PATTERNS = [/frustrated/i, /annoying/i, /stupid/i, /angry/i, /upset/i, /hate/i];

export class SentimentAnalyzer {
  private provider: LLMProvider | null = null;

  setProvider(provider: LLMProvider): void {
    this.provider = provider;
  }

  /**
   * Fast rule-based sentiment analysis (synchronous)
   */
  analyzeRuleBased(input: string): SentimentResult {
    const lower = input.toLowerCase();
    let bestMood: MoodState | 'neutral' = 'neutral';
    let bestScore = 0;

    // Check each mood pattern
    for (const [mood, patterns] of Object.entries(MOOD_PATTERNS)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMood = mood as MoodState;
      }
    }

    // Check for negative sentiment (shifts to focused)
    for (const pattern of NEGATIVE_PATTERNS) {
      if (pattern.test(lower)) {
        bestMood = 'focused';
        bestScore = Math.max(bestScore, 1);
        break;
      }
    }

    // Determine energy
    let energy: 'up' | 'down' | 'neutral' = 'neutral';
    let energyUp = 0;
    let energyDown = 0;

    for (const pattern of ENERGY_PATTERNS.up) {
      const matches = input.match(pattern);
      if (matches) energyUp += matches.length;
    }

    for (const pattern of ENERGY_PATTERNS.down) {
      if (pattern instanceof RegExp && pattern.test(input)) {
        energyDown++;
      }
    }

    if (energyUp > energyDown + 1) energy = 'up';
    else if (energyDown > energyUp) energy = 'down';

    // Calculate confidence based on pattern matches
    const confidence = Math.min(bestScore / 3, 1);

    return { mood: bestMood, energy, confidence };
  }

  /**
   * LLM-based sentiment analysis (more accurate but async)
   */
  async analyze(input: string): Promise<SentimentResult> {
    // Fall back to rule-based if no provider
    if (!this.provider) {
      return this.analyzeRuleBased(input);
    }

    try {
      const prompt = `Analyze the emotional tone of this message and respond with ONLY a JSON object.

Message: "${input}"

Respond with this exact format:
{"mood":"<one of: curious, playful, focused, warm, reflective, tired, excited, neutral>","energy":"<one of: up, down, neutral>","confidence":<0.0 to 1.0>}`;

      const response = await this.provider.generate(prompt, {
        mode: 'react',
        maxTokens: 60,
        temperature: 0.3,
        stream: false,
      });

      const match = response.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          mood: this.validateMood(parsed.mood),
          energy: this.validateEnergy(parsed.energy),
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        };
      }
    } catch {
      // Fall back to rule-based on error
    }

    return this.analyzeRuleBased(input);
  }

  private validateMood(mood: string): MoodState | 'neutral' {
    const validMoods: (MoodState | 'neutral')[] = [
      'curious',
      'playful',
      'focused',
      'warm',
      'reflective',
      'tired',
      'excited',
      'neutral',
    ];
    return validMoods.includes(mood as MoodState) ? (mood as MoodState) : 'neutral';
  }

  private validateEnergy(energy: string): 'up' | 'down' | 'neutral' {
    if (energy === 'up' || energy === 'down') return energy;
    return 'neutral';
  }
}
