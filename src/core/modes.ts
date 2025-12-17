// Nexi Behavioral Modes - How Nexi adapts her response style

import { BehavioralMode } from '../types/index.js';

interface ModeConfig {
  name: string;
  description: string;
  maxTokens: number;
  temperature: number;
  suggestedLength: 'very_short' | 'short' | 'medium' | 'long';
}

export const MODE_CONFIGS: Record<BehavioralMode, ModeConfig> = {
  react: {
    name: 'React Mode',
    description: 'Fast, emotional, 1-2 sentences',
    maxTokens: 150,
    temperature: 0.9,
    suggestedLength: 'very_short',
  },
  chat: {
    name: 'Chat Mode',
    description: 'Normal conversation, balanced',
    maxTokens: 500,
    temperature: 0.8,
    suggestedLength: 'medium',
  },
  think: {
    name: 'Think Mode',
    description: 'Reflective, strategic, detailed',
    maxTokens: 1500,
    temperature: 0.7,
    suggestedLength: 'long',
  },
  offline: {
    name: 'Offline Mode',
    description: 'Internal processing, no audience',
    maxTokens: 1000,
    temperature: 0.6,
    suggestedLength: 'medium',
  },
};

/**
 * Detect appropriate mode from user input
 */
export function detectMode(input: string, currentMode: BehavioralMode): BehavioralMode {
  const lowerInput = input.toLowerCase().trim();

  // Explicit mode switches
  if (lowerInput.startsWith('/react') || lowerInput.startsWith('/quick')) {
    return 'react';
  }
  if (lowerInput.startsWith('/chat') || lowerInput.startsWith('/normal')) {
    return 'chat';
  }
  if (lowerInput.startsWith('/think') || lowerInput.startsWith('/deep')) {
    return 'think';
  }

  // Contextual detection
  // Short inputs suggest react mode
  if (lowerInput.length < 20 && !lowerInput.includes('?')) {
    // Very short statements might want quick reactions
    if (currentMode === 'chat') {
      return 'react';
    }
  }

  // Complex questions suggest think mode
  const thinkIndicators = [
    'explain',
    'how does',
    'why do',
    'what if',
    'help me understand',
    'walk me through',
    'think about',
    'analyze',
    'consider',
    'plan',
  ];

  if (thinkIndicators.some((indicator) => lowerInput.includes(indicator))) {
    return 'think';
  }

  // Default to current mode or chat
  return currentMode;
}

/**
 * Get mode configuration
 */
export function getModeConfig(mode: BehavioralMode): ModeConfig {
  return MODE_CONFIGS[mode];
}

/**
 * Get user-friendly mode name
 */
export function getModeName(mode: BehavioralMode): string {
  return MODE_CONFIGS[mode].name;
}

/**
 * Parse mode command from input and return cleaned input
 */
export function parseModeCommand(input: string): {
  mode: BehavioralMode | null;
  cleanedInput: string;
} {
  const modeCommands: Record<string, BehavioralMode> = {
    '/react': 'react',
    '/quick': 'react',
    '/chat': 'chat',
    '/normal': 'chat',
    '/think': 'think',
    '/deep': 'think',
  };

  for (const [command, mode] of Object.entries(modeCommands)) {
    if (input.toLowerCase().startsWith(command)) {
      return {
        mode,
        cleanedInput: input.slice(command.length).trim(),
      };
    }
  }

  return { mode: null, cleanedInput: input };
}
