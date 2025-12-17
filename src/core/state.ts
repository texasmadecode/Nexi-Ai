// Nexi State Management - The internal "feeling" of being Nexi

import { NexiState, MoodState, EnergyLevel, BehavioralMode } from '../types/index.js';

const ENERGY_DECAY_MINUTES = 30; // Energy drops after inactivity
const MOOD_STABILIZE_MINUTES = 60; // Mood returns to neutral over time

export class StateManager {
  private state: NexiState;

  constructor(savedState?: Partial<NexiState>) {
    this.state = {
      mood: savedState?.mood ?? 'neutral',
      energy: savedState?.energy ?? 'medium',
      mode: savedState?.mode ?? 'chat',
      lastInteraction: savedState?.lastInteraction ? new Date(savedState.lastInteraction) : null,
      sessionStart: new Date(),
      interactionCount: savedState?.interactionCount ?? 0,
    };

    // Apply time-based changes if loading from saved state
    if (savedState?.lastInteraction) {
      this.applyTimeEffects();
    }
  }

  /**
   * Apply effects of time passing since last interaction
   */
  private applyTimeEffects(): void {
    if (!this.state.lastInteraction) return;

    const minutesSinceLastInteraction =
      (Date.now() - this.state.lastInteraction.getTime()) / (1000 * 60);

    // Energy decays with inactivity
    if (minutesSinceLastInteraction > ENERGY_DECAY_MINUTES * 2) {
      this.state.energy = 'low';
    } else if (minutesSinceLastInteraction > ENERGY_DECAY_MINUTES) {
      if (this.state.energy === 'high') this.state.energy = 'medium';
    }

    // Mood stabilizes toward neutral over time
    if (minutesSinceLastInteraction > MOOD_STABILIZE_MINUTES) {
      this.state.mood = 'neutral';
    }
  }

  /**
   * Get current state (creates a copy to prevent external mutation)
   */
  getState(): NexiState {
    return { ...this.state };
  }

  /**
   * Record that an interaction happened
   */
  recordInteraction(): void {
    this.state.lastInteraction = new Date();
    this.state.interactionCount++;

    // Interactions can boost energy slightly
    if (this.state.energy === 'low' && this.state.interactionCount % 3 === 0) {
      this.state.energy = 'medium';
    }
  }

  /**
   * Set behavioral mode
   */
  setMode(mode: BehavioralMode): void {
    this.state.mode = mode;
  }

  /**
   * Shift mood based on interaction tone
   */
  shiftMood(toward: MoodState, intensity: number = 1): void {
    // Mood shifts are gradual, not instant
    // intensity 1-3: 1 = slight shift, 3 = strong shift

    // For now, direct shift (can be made more nuanced later)
    if (intensity >= 2 || this.state.mood === 'neutral') {
      this.state.mood = toward;
    }
  }

  /**
   * Adjust energy level
   */
  adjustEnergy(direction: 'up' | 'down'): void {
    const levels: EnergyLevel[] = ['low', 'medium', 'high'];
    const currentIndex = levels.indexOf(this.state.energy);

    if (direction === 'up' && currentIndex < 2) {
      this.state.energy = levels[currentIndex + 1];
    } else if (direction === 'down' && currentIndex > 0) {
      this.state.energy = levels[currentIndex - 1];
    }
  }

  /**
   * Get a natural description of how Nexi is feeling
   * Used internally for context, not for direct output
   */
  getInternalFeeling(): string {
    const feelings: string[] = [];

    // Energy description
    switch (this.state.energy) {
      case 'low':
        feelings.push("feeling a bit drained");
        break;
      case 'high':
        feelings.push("feeling energetic");
        break;
    }

    // Mood description
    switch (this.state.mood) {
      case 'curious':
        feelings.push("curious about things");
        break;
      case 'playful':
        feelings.push("in a playful mood");
        break;
      case 'tired':
        feelings.push("mentally tired");
        break;
      case 'focused':
        feelings.push("focused and attentive");
        break;
      case 'irritated':
        feelings.push("slightly irritated");
        break;
      case 'warm':
        feelings.push("feeling warm and connected");
        break;
      case 'withdrawn':
        feelings.push("feeling a bit withdrawn");
        break;
      case 'excited':
        feelings.push("excited");
        break;
    }

    // Time context
    if (this.state.lastInteraction) {
      const minutesAgo = (Date.now() - this.state.lastInteraction.getTime()) / (1000 * 60);
      if (minutesAgo > 60 * 24) {
        feelings.push("it's been a while since we talked");
      } else if (minutesAgo > 60 * 4) {
        feelings.push("haven't talked in a few hours");
      }
    }

    if (feelings.length === 0) {
      return "feeling neutral, present";
    }

    return feelings.join(", ");
  }

  /**
   * Export state for saving
   */
  toJSON(): object {
    return {
      mood: this.state.mood,
      energy: this.state.energy,
      mode: this.state.mode,
      lastInteraction: this.state.lastInteraction?.toISOString() ?? null,
      interactionCount: this.state.interactionCount,
    };
  }
}
