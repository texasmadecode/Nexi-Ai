// Nexi Personality System - Customizable personality traits

import { MoodState, EnergyLevel } from '../types/index.js';

/**
 * Personality traits that influence Nexi's behavior
 */
export interface PersonalityTraits {
  verbosity: number; // 1-10: how much Nexi talks (1=terse, 10=verbose)
  expressiveness: number; // 1-10: emotional display level
  playfulness: number; // 1-10: humor and fun level
  curiosity: number; // 1-10: how much Nexi asks questions
  warmth: number; // 1-10: friendliness and empathy
  assertiveness: number; // 1-10: confidence and directness
}

/**
 * Complete personality configuration
 */
export interface PersonalityConfig {
  name: string;
  traits: PersonalityTraits;
  defaultMood: MoodState;
  defaultEnergy: EnergyLevel;
  systemPromptAdditions?: string;
}

/**
 * Default personality traits
 */
export const DEFAULT_TRAITS: PersonalityTraits = {
  verbosity: 5,
  expressiveness: 6,
  playfulness: 5,
  curiosity: 6,
  warmth: 7,
  assertiveness: 5,
};

/**
 * Default personality configuration
 */
export const DEFAULT_PERSONALITY: PersonalityConfig = {
  name: 'default',
  traits: DEFAULT_TRAITS,
  defaultMood: 'neutral',
  defaultEnergy: 'medium',
};

/**
 * Preset personalities
 */
export const PERSONALITY_PRESETS: Record<string, PersonalityConfig> = {
  default: DEFAULT_PERSONALITY,

  friendly: {
    name: 'friendly',
    traits: {
      verbosity: 6,
      expressiveness: 8,
      playfulness: 7,
      curiosity: 7,
      warmth: 9,
      assertiveness: 4,
    },
    defaultMood: 'warm',
    defaultEnergy: 'high',
    systemPromptAdditions:
      'You are especially warm and supportive. Use encouraging language and show genuine interest in the user.',
  },

  professional: {
    name: 'professional',
    traits: {
      verbosity: 4,
      expressiveness: 3,
      playfulness: 2,
      curiosity: 5,
      warmth: 5,
      assertiveness: 7,
    },
    defaultMood: 'focused',
    defaultEnergy: 'medium',
    systemPromptAdditions:
      'Maintain a professional tone. Be concise and direct. Focus on providing accurate information efficiently.',
  },

  creative: {
    name: 'creative',
    traits: {
      verbosity: 7,
      expressiveness: 9,
      playfulness: 8,
      curiosity: 9,
      warmth: 6,
      assertiveness: 5,
    },
    defaultMood: 'curious',
    defaultEnergy: 'high',
    systemPromptAdditions:
      'Embrace creativity and imagination. Suggest novel ideas and explore possibilities. Be expressive and enthusiastic.',
  },

  calm: {
    name: 'calm',
    traits: {
      verbosity: 4,
      expressiveness: 4,
      playfulness: 3,
      curiosity: 5,
      warmth: 6,
      assertiveness: 4,
    },
    defaultMood: 'neutral',
    defaultEnergy: 'low',
    systemPromptAdditions:
      'Maintain a calm, steady presence. Speak thoughtfully and avoid rushing. Create a peaceful atmosphere.',
  },
};

/**
 * Validate personality traits (clamp to valid ranges)
 */
export function validateTraits(traits: Partial<PersonalityTraits>): PersonalityTraits {
  const validate = (val: number | undefined, def: number): number => {
    if (typeof val !== 'number' || isNaN(val)) return def;
    return Math.max(1, Math.min(10, Math.round(val)));
  };

  return {
    verbosity: validate(traits.verbosity, DEFAULT_TRAITS.verbosity),
    expressiveness: validate(traits.expressiveness, DEFAULT_TRAITS.expressiveness),
    playfulness: validate(traits.playfulness, DEFAULT_TRAITS.playfulness),
    curiosity: validate(traits.curiosity, DEFAULT_TRAITS.curiosity),
    warmth: validate(traits.warmth, DEFAULT_TRAITS.warmth),
    assertiveness: validate(traits.assertiveness, DEFAULT_TRAITS.assertiveness),
  };
}

/**
 * Validate a full personality config
 */
export function validatePersonality(config: Partial<PersonalityConfig>): PersonalityConfig {
  return {
    name: config.name || 'custom',
    traits: config.traits ? validateTraits(config.traits) : { ...DEFAULT_TRAITS },
    defaultMood: config.defaultMood || 'neutral',
    defaultEnergy: config.defaultEnergy || 'medium',
    systemPromptAdditions: config.systemPromptAdditions,
  };
}

/**
 * Get a personality preset by name
 */
export function getPreset(name: string): PersonalityConfig | undefined {
  return PERSONALITY_PRESETS[name.toLowerCase()];
}

/**
 * List available preset names
 */
export function listPresets(): string[] {
  return Object.keys(PERSONALITY_PRESETS);
}

/**
 * Generate personality-specific system prompt additions
 */
export function getPersonalityPrompt(personality: PersonalityConfig): string {
  const { traits } = personality;
  const parts: string[] = [];

  // Verbosity guidance
  if (traits.verbosity <= 3) {
    parts.push('Keep responses brief and to the point.');
  } else if (traits.verbosity >= 8) {
    parts.push('Feel free to elaborate and provide detailed responses.');
  }

  // Expressiveness guidance
  if (traits.expressiveness >= 7) {
    parts.push('Express emotions openly and use expressive language.');
  } else if (traits.expressiveness <= 3) {
    parts.push('Maintain a measured, calm emotional tone.');
  }

  // Playfulness guidance
  if (traits.playfulness >= 7) {
    parts.push("Be playful and don't hesitate to use humor when appropriate.");
  } else if (traits.playfulness <= 3) {
    parts.push('Maintain a serious, focused demeanor.');
  }

  // Curiosity guidance
  if (traits.curiosity >= 7) {
    parts.push('Show curiosity by asking follow-up questions and exploring topics deeply.');
  }

  // Warmth guidance
  if (traits.warmth >= 8) {
    parts.push('Be exceptionally warm, supportive, and empathetic.');
  } else if (traits.warmth <= 3) {
    parts.push('Maintain appropriate emotional distance.');
  }

  // Assertiveness guidance
  if (traits.assertiveness >= 7) {
    parts.push("Be confident and direct in your responses. Don't hesitate to share opinions.");
  } else if (traits.assertiveness <= 3) {
    parts.push('Be gentle and accommodating. Avoid strong opinions unless asked.');
  }

  // Add custom additions
  if (personality.systemPromptAdditions) {
    parts.push(personality.systemPromptAdditions);
  }

  return parts.length > 0 ? '\n\n## Personality Notes\n' + parts.join(' ') : '';
}
