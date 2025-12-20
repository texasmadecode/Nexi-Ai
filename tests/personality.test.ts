import { describe, it, expect } from 'vitest';
import {
  PERSONALITY_PRESETS,
  validateTraits,
  validatePersonality,
  getPreset,
  listPresets,
  getPersonalityPrompt,
} from '../src/core/personality.js';

describe('Personality System', () => {
  describe('validateTraits', () => {
    it('should clamp values to valid range (1-10)', () => {
      const traits = validateTraits({
        verbosity: 0,
        expressiveness: 15,
        playfulness: 5,
        curiosity: -5,
        warmth: 100,
        assertiveness: 5.7,
      });

      expect(traits.verbosity).toBe(1);
      expect(traits.expressiveness).toBe(10);
      expect(traits.playfulness).toBe(5);
      expect(traits.curiosity).toBe(1);
      expect(traits.warmth).toBe(10);
      expect(traits.assertiveness).toBe(6); // Rounded
    });

    it('should use defaults for missing/invalid values', () => {
      const traits = validateTraits({
        verbosity: NaN,
        expressiveness: undefined as unknown as number,
      });

      expect(traits.verbosity).toBe(5); // default
      expect(traits.expressiveness).toBe(6); // default
    });
  });

  describe('validatePersonality', () => {
    it('should validate a full personality config', () => {
      const personality = validatePersonality({
        name: 'test',
        traits: { verbosity: 3 },
        defaultMood: 'curious',
        defaultEnergy: 'high',
      });

      expect(personality.name).toBe('test');
      expect(personality.traits.verbosity).toBe(3);
      expect(personality.defaultMood).toBe('curious');
      expect(personality.defaultEnergy).toBe('high');
    });

    it('should use defaults for missing fields', () => {
      const personality = validatePersonality({});

      expect(personality.name).toBe('custom');
      expect(personality.defaultMood).toBe('neutral');
      expect(personality.defaultEnergy).toBe('medium');
    });
  });

  describe('presets', () => {
    it('should list available presets', () => {
      const presets = listPresets();

      expect(presets).toContain('default');
      expect(presets).toContain('friendly');
      expect(presets).toContain('professional');
      expect(presets).toContain('creative');
      expect(presets).toContain('calm');
    });

    it('should get preset by name', () => {
      const friendly = getPreset('friendly');

      expect(friendly).toBeDefined();
      expect(friendly!.name).toBe('friendly');
      expect(friendly!.traits.warmth).toBeGreaterThanOrEqual(8);
    });

    it('should return undefined for unknown preset', () => {
      const unknown = getPreset('nonexistent');
      expect(unknown).toBeUndefined();
    });

    it('should be case insensitive', () => {
      const preset = getPreset('FRIENDLY');
      expect(preset).toBeDefined();
    });
  });

  describe('getPersonalityPrompt', () => {
    it('should generate prompt additions for high verbosity', () => {
      const personality = validatePersonality({
        traits: { verbosity: 9 },
      });

      const prompt = getPersonalityPrompt(personality);
      expect(prompt).toContain('elaborate');
    });

    it('should generate prompt additions for low verbosity', () => {
      const personality = validatePersonality({
        traits: { verbosity: 2 },
      });

      const prompt = getPersonalityPrompt(personality);
      expect(prompt).toContain('brief');
    });

    it('should include custom system prompt additions', () => {
      const personality = validatePersonality({
        systemPromptAdditions: 'Custom instruction here',
      });

      const prompt = getPersonalityPrompt(personality);
      expect(prompt).toContain('Custom instruction here');
    });

    it('should return empty string for neutral traits', () => {
      const personality = validatePersonality({
        traits: {
          verbosity: 5,
          expressiveness: 5,
          playfulness: 5,
          curiosity: 5,
          warmth: 5,
          assertiveness: 5,
        },
      });

      const prompt = getPersonalityPrompt(personality);
      expect(prompt).toBe('');
    });
  });

  describe('preset configurations', () => {
    it('friendly preset should have high warmth', () => {
      const friendly = PERSONALITY_PRESETS.friendly;

      expect(friendly.traits.warmth).toBeGreaterThanOrEqual(8);
      expect(friendly.defaultMood).toBe('warm');
    });

    it('professional preset should have low playfulness', () => {
      const professional = PERSONALITY_PRESETS.professional;

      expect(professional.traits.playfulness).toBeLessThanOrEqual(3);
      expect(professional.traits.assertiveness).toBeGreaterThanOrEqual(6);
    });

    it('creative preset should have high curiosity', () => {
      const creative = PERSONALITY_PRESETS.creative;

      expect(creative.traits.curiosity).toBeGreaterThanOrEqual(8);
      expect(creative.traits.expressiveness).toBeGreaterThanOrEqual(8);
    });

    it('calm preset should have low energy', () => {
      const calm = PERSONALITY_PRESETS.calm;

      expect(calm.defaultEnergy).toBe('low');
      expect(calm.traits.expressiveness).toBeLessThanOrEqual(5);
    });
  });
});
