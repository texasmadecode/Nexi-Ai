import { describe, it, expect } from 'vitest';
import {
  detectMode,
  getModeConfig,
  getModeName,
  parseModeCommand,
  MODE_CONFIGS,
} from '../src/core/modes.js';

describe('Mode System', () => {
  describe('MODE_CONFIGS', () => {
    it('should have all four modes configured', () => {
      expect(MODE_CONFIGS).toHaveProperty('react');
      expect(MODE_CONFIGS).toHaveProperty('chat');
      expect(MODE_CONFIGS).toHaveProperty('think');
      expect(MODE_CONFIGS).toHaveProperty('offline');
    });

    it('should have correct structure for each mode', () => {
      for (const config of Object.values(MODE_CONFIGS)) {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('maxTokens');
        expect(config).toHaveProperty('temperature');
        expect(config).toHaveProperty('suggestedLength');
        expect(typeof config.maxTokens).toBe('number');
        expect(typeof config.temperature).toBe('number');
      }
    });

    it('should have increasing maxTokens from react to think', () => {
      expect(MODE_CONFIGS.react.maxTokens).toBeLessThan(MODE_CONFIGS.chat.maxTokens);
      expect(MODE_CONFIGS.chat.maxTokens).toBeLessThan(MODE_CONFIGS.think.maxTokens);
    });
  });

  describe('detectMode', () => {
    it('should detect /react command', () => {
      expect(detectMode('/react hello', 'chat')).toBe('react');
      expect(detectMode('/quick response', 'chat')).toBe('react');
    });

    it('should detect /chat command', () => {
      expect(detectMode('/chat with me', 'react')).toBe('chat');
      expect(detectMode('/normal mode', 'react')).toBe('chat');
    });

    it('should detect /think command', () => {
      expect(detectMode('/think deeply', 'chat')).toBe('think');
      expect(detectMode('/deep analysis', 'chat')).toBe('think');
    });

    it('should detect think mode from think indicators', () => {
      expect(detectMode('explain how this works', 'chat')).toBe('think');
      expect(detectMode('how does the algorithm function', 'chat')).toBe('think');
      expect(detectMode('why do we need this feature', 'chat')).toBe('think');
      expect(detectMode('analyze the performance', 'chat')).toBe('think');
      expect(detectMode('help me understand the concept', 'chat')).toBe('think');
      expect(detectMode('walk me through the process', 'chat')).toBe('think');
      expect(detectMode('consider the alternatives', 'chat')).toBe('think');
    });

    it('should suggest react mode for short non-question inputs from chat mode', () => {
      expect(detectMode('hello', 'chat')).toBe('react');
      expect(detectMode('nice!', 'chat')).toBe('react');
      expect(detectMode('thanks', 'chat')).toBe('react');
    });

    it('should keep current mode for short inputs if not in chat mode', () => {
      expect(detectMode('hello', 'think')).toBe('think');
      expect(detectMode('nice!', 'react')).toBe('react');
    });

    it('should keep current mode for regular messages without indicators', () => {
      expect(detectMode('I have a regular question?', 'chat')).toBe('chat');
      expect(detectMode('This is a normal message', 'think')).toBe('think');
    });
  });

  describe('getModeConfig', () => {
    it('should return config for react mode', () => {
      const config = getModeConfig('react');
      expect(config.name).toBe('React Mode');
      expect(config.suggestedLength).toBe('very_short');
    });

    it('should return config for chat mode', () => {
      const config = getModeConfig('chat');
      expect(config.name).toBe('Chat Mode');
      expect(config.suggestedLength).toBe('medium');
    });

    it('should return config for think mode', () => {
      const config = getModeConfig('think');
      expect(config.name).toBe('Think Mode');
      expect(config.suggestedLength).toBe('long');
    });

    it('should return config for offline mode', () => {
      const config = getModeConfig('offline');
      expect(config.name).toBe('Offline Mode');
    });
  });

  describe('getModeName', () => {
    it('should return human-readable mode names', () => {
      expect(getModeName('react')).toBe('React Mode');
      expect(getModeName('chat')).toBe('Chat Mode');
      expect(getModeName('think')).toBe('Think Mode');
      expect(getModeName('offline')).toBe('Offline Mode');
    });
  });

  describe('parseModeCommand', () => {
    it('should parse /react command', () => {
      const result = parseModeCommand('/react hello world');
      expect(result.mode).toBe('react');
      expect(result.cleanedInput).toBe('hello world');
    });

    it('should parse /quick command as react', () => {
      const result = parseModeCommand('/quick response needed');
      expect(result.mode).toBe('react');
      expect(result.cleanedInput).toBe('response needed');
    });

    it('should parse /chat command', () => {
      const result = parseModeCommand('/chat lets talk');
      expect(result.mode).toBe('chat');
      expect(result.cleanedInput).toBe('lets talk');
    });

    it('should parse /normal command as chat', () => {
      const result = parseModeCommand('/normal mode now');
      expect(result.mode).toBe('chat');
      expect(result.cleanedInput).toBe('mode now');
    });

    it('should parse /think command', () => {
      const result = parseModeCommand('/think about this deeply');
      expect(result.mode).toBe('think');
      expect(result.cleanedInput).toBe('about this deeply');
    });

    it('should parse /deep command as think', () => {
      const result = parseModeCommand('/deep analysis required');
      expect(result.mode).toBe('think');
      expect(result.cleanedInput).toBe('analysis required');
    });

    it('should return null mode for non-command input', () => {
      const result = parseModeCommand('regular message');
      expect(result.mode).toBeNull();
      expect(result.cleanedInput).toBe('regular message');
    });

    it('should handle command with no following text', () => {
      const result = parseModeCommand('/react');
      expect(result.mode).toBe('react');
      expect(result.cleanedInput).toBe('');
    });

    it('should be case-insensitive', () => {
      expect(parseModeCommand('/REACT hello').mode).toBe('react');
      expect(parseModeCommand('/Think deeply').mode).toBe('think');
    });
  });
});
