import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../src/core/state.js';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const state = stateManager.getState();
      expect(state.mood).toBe('neutral');
      expect(state.energy).toBe('medium');
      expect(state.mode).toBe('chat');
      expect(state.interactionCount).toBe(0);
      expect(state.lastInteraction).toBeNull();
    });

    it('should restore from saved state', () => {
      const savedState = {
        mood: 'curious' as const,
        energy: 'high' as const,
        mode: 'think' as const,
        interactionCount: 10,
      };
      const restored = new StateManager(savedState);
      const state = restored.getState();

      expect(state.mood).toBe('curious');
      expect(state.energy).toBe('high');
      expect(state.mode).toBe('think');
      expect(state.interactionCount).toBe(10);
    });
  });

  describe('recordInteraction', () => {
    it('should increment interaction count', () => {
      stateManager.recordInteraction();
      expect(stateManager.getState().interactionCount).toBe(1);

      stateManager.recordInteraction();
      expect(stateManager.getState().interactionCount).toBe(2);
    });

    it('should update lastInteraction timestamp', () => {
      const before = Date.now();
      stateManager.recordInteraction();
      const after = Date.now();

      const lastInteraction = stateManager.getState().lastInteraction;
      expect(lastInteraction).not.toBeNull();
      expect(lastInteraction!.getTime()).toBeGreaterThanOrEqual(before);
      expect(lastInteraction!.getTime()).toBeLessThanOrEqual(after);
    });

    it('should boost energy from low after 3 interactions', () => {
      const lowEnergyState = new StateManager({ energy: 'low' });
      expect(lowEnergyState.getState().energy).toBe('low');

      lowEnergyState.recordInteraction(); // 1
      lowEnergyState.recordInteraction(); // 2
      expect(lowEnergyState.getState().energy).toBe('low');

      lowEnergyState.recordInteraction(); // 3
      expect(lowEnergyState.getState().energy).toBe('medium');
    });
  });

  describe('setMode', () => {
    it('should change behavioral mode', () => {
      stateManager.setMode('think');
      expect(stateManager.getState().mode).toBe('think');

      stateManager.setMode('react');
      expect(stateManager.getState().mode).toBe('react');
    });
  });

  describe('shiftMood', () => {
    it('should shift mood when starting from neutral', () => {
      stateManager.shiftMood('curious');
      expect(stateManager.getState().mood).toBe('curious');
    });

    it('should shift mood with intensity >= 2', () => {
      stateManager.shiftMood('warm');
      expect(stateManager.getState().mood).toBe('warm');

      stateManager.shiftMood('playful', 2);
      expect(stateManager.getState().mood).toBe('playful');
    });

    it('should not shift mood with low intensity when not neutral', () => {
      stateManager.shiftMood('warm', 2);
      expect(stateManager.getState().mood).toBe('warm');

      stateManager.shiftMood('curious', 1);
      expect(stateManager.getState().mood).toBe('warm'); // unchanged
    });
  });

  describe('adjustEnergy', () => {
    it('should increase energy from low to medium', () => {
      const mgr = new StateManager({ energy: 'low' });
      mgr.adjustEnergy('up');
      expect(mgr.getState().energy).toBe('medium');
    });

    it('should increase energy from medium to high', () => {
      const mgr = new StateManager({ energy: 'medium' });
      mgr.adjustEnergy('up');
      expect(mgr.getState().energy).toBe('high');
    });

    it('should not increase energy above high', () => {
      const mgr = new StateManager({ energy: 'high' });
      mgr.adjustEnergy('up');
      expect(mgr.getState().energy).toBe('high');
    });

    it('should decrease energy from high to medium', () => {
      const mgr = new StateManager({ energy: 'high' });
      mgr.adjustEnergy('down');
      expect(mgr.getState().energy).toBe('medium');
    });

    it('should decrease energy from medium to low', () => {
      const mgr = new StateManager({ energy: 'medium' });
      mgr.adjustEnergy('down');
      expect(mgr.getState().energy).toBe('low');
    });

    it('should not decrease energy below low', () => {
      const mgr = new StateManager({ energy: 'low' });
      mgr.adjustEnergy('down');
      expect(mgr.getState().energy).toBe('low');
    });
  });

  describe('getInternalFeeling', () => {
    it('should return neutral feeling for default state', () => {
      expect(stateManager.getInternalFeeling()).toBe('feeling neutral, present');
    });

    it('should describe low energy', () => {
      const mgr = new StateManager({ energy: 'low' });
      expect(mgr.getInternalFeeling()).toContain('drained');
    });

    it('should describe high energy', () => {
      const mgr = new StateManager({ energy: 'high' });
      expect(mgr.getInternalFeeling()).toContain('energetic');
    });

    it('should describe curious mood', () => {
      const mgr = new StateManager({ mood: 'curious' });
      expect(mgr.getInternalFeeling()).toContain('curious');
    });

    it('should describe warm mood', () => {
      const mgr = new StateManager({ mood: 'warm' });
      expect(mgr.getInternalFeeling()).toContain('warm');
    });
  });

  describe('toJSON', () => {
    it('should export state for saving', () => {
      stateManager.setMode('think');
      stateManager.shiftMood('focused', 2);
      stateManager.recordInteraction();

      const json = stateManager.toJSON() as any;

      expect(json.mode).toBe('think');
      expect(json.mood).toBe('focused');
      expect(json.interactionCount).toBe(1);
      expect(json.lastInteraction).toBeDefined();
    });
  });

  describe('time effects', () => {
    it('should decay energy after long inactivity', () => {
      const pastTime = new Date();
      pastTime.setMinutes(pastTime.getMinutes() - 35); // 35 minutes ago (> 30, < 60)

      const mgr = new StateManager({
        energy: 'high',
        lastInteraction: pastTime,
      });

      // Energy should have decayed from high -> medium (after ENERGY_DECAY_MINUTES but before *2)
      expect(mgr.getState().energy).toBe('medium');
    });

    it('should set energy to low after very long inactivity', () => {
      const pastTime = new Date();
      pastTime.setMinutes(pastTime.getMinutes() - 120); // 2 hours ago

      const mgr = new StateManager({
        energy: 'high',
        lastInteraction: pastTime,
      });

      expect(mgr.getState().energy).toBe('low');
    });

    it('should reset mood to neutral after long inactivity', () => {
      const pastTime = new Date();
      pastTime.setMinutes(pastTime.getMinutes() - 90); // 90 minutes ago

      const mgr = new StateManager({
        mood: 'excited',
        lastInteraction: pastTime,
      });

      expect(mgr.getState().mood).toBe('neutral');
    });
  });
});
