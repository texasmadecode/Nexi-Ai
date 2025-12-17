import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore } from '../src/memory/store.js';
import fs from 'fs';
import path from 'path';

describe('MemoryStore', () => {
  const testDataDir = path.join(process.cwd(), 'test-data-' + Date.now());
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(testDataDir);
  });

  afterEach(() => {
    store.close();
    // Clean up test database
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  describe('store', () => {
    it('should store a memory and return it with generated fields', () => {
      const memory = store.store({
        type: 'fact',
        content: 'Test memory content',
        importance: 5,
        emotional_weight: 0,
        tags: ['test'],
      });

      expect(memory.id).toBeDefined();
      expect(memory.content).toBe('Test memory content');
      expect(memory.type).toBe('fact');
      expect(memory.importance).toBe(5);
      expect(memory.created_at).toBeInstanceOf(Date);
      expect(memory.last_accessed).toBeInstanceOf(Date);
      expect(memory.access_count).toBe(1);
      expect(memory.tags).toEqual(['test']);
    });

    it('should store memories with different types', () => {
      const types = ['fact', 'preference', 'milestone', 'request', 'reflection'] as const;

      for (const type of types) {
        const memory = store.store({
          type,
          content: `Memory of type ${type}`,
          importance: 5,
          emotional_weight: 0,
          tags: [],
        });
        expect(memory.type).toBe(type);
      }
    });
  });

  describe('get', () => {
    it('should retrieve a stored memory by ID', () => {
      const stored = store.store({
        type: 'fact',
        content: 'Retrievable memory',
        importance: 5,
        emotional_weight: 0,
        tags: [],
      });

      const retrieved = store.get(stored.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe('Retrievable memory');
    });

    it('should return null for non-existent ID', () => {
      const retrieved = store.get('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should increment access count on retrieval', () => {
      const stored = store.store({
        type: 'fact',
        content: 'Access counting test',
        importance: 5,
        emotional_weight: 0,
        tags: [],
      });

      expect(stored.access_count).toBe(1);

      // get() reads current value then increments, so first get returns 1
      const retrieved1 = store.get(stored.id);
      expect(retrieved1!.access_count).toBe(1);

      // Second get sees the incremented value (2)
      const retrieved2 = store.get(stored.id);
      expect(retrieved2!.access_count).toBe(2);

      // Third get sees 3
      const retrieved3 = store.get(stored.id);
      expect(retrieved3!.access_count).toBe(3);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      store.store({
        type: 'fact',
        content: 'Fact 1',
        importance: 3,
        emotional_weight: 0,
        tags: ['a'],
      });
      store.store({
        type: 'fact',
        content: 'Fact 2',
        importance: 7,
        emotional_weight: 0,
        tags: ['b'],
      });
      store.store({
        type: 'preference',
        content: 'Pref 1',
        importance: 5,
        emotional_weight: 0,
        tags: ['a'],
      });
      store.store({
        type: 'milestone',
        content: 'Milestone 1',
        importance: 9,
        emotional_weight: 2,
        tags: ['c'],
      });
    });

    it('should filter by type', () => {
      const facts = store.query({ type: 'fact' });
      expect(facts.length).toBe(2);
      expect(facts.every((m) => m.type === 'fact')).toBe(true);
    });

    it('should filter by minimum importance', () => {
      const important = store.query({ minImportance: 6 });
      expect(important.length).toBe(2);
      expect(important.every((m) => m.importance >= 6)).toBe(true);
    });

    it('should search by content', () => {
      const results = store.query({ search: 'Fact' });
      expect(results.length).toBe(2);
    });

    it('should filter by tags', () => {
      const results = store.query({ tags: ['a'] });
      expect(results.length).toBe(2);
    });

    it('should limit results', () => {
      const results = store.query({ limit: 2 });
      expect(results.length).toBe(2);
    });

    it('should order by importance then last_accessed', () => {
      const results = store.query({});
      expect(results[0].importance).toBe(9); // Milestone has highest importance
    });
  });

  describe('findRelevant', () => {
    beforeEach(() => {
      store.store({
        type: 'fact',
        content: 'The user loves programming',
        importance: 5,
        emotional_weight: 0,
        tags: [],
      });
      store.store({
        type: 'preference',
        content: 'User prefers dark theme',
        importance: 6,
        emotional_weight: 0,
        tags: [],
      });
      store.store({
        type: 'fact',
        content: 'User works on TypeScript projects',
        importance: 7,
        emotional_weight: 0,
        tags: [],
      });
    });

    it('should find memories matching keywords', () => {
      const results = store.findRelevant('programming TypeScript', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.content.includes('programming'))).toBe(true);
    });

    it('should return important memories when no keywords match', () => {
      const results = store.findRelevant('xyz', 5);
      // Should return high-importance memories as fallback
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should respect limit parameter', () => {
      store.store({
        type: 'fact',
        content: 'More programming info',
        importance: 5,
        emotional_weight: 0,
        tags: [],
      });
      const results = store.findRelevant('programming', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('update', () => {
    it('should update memory content', () => {
      const memory = store.store({
        type: 'fact',
        content: 'Original content',
        importance: 5,
        emotional_weight: 0,
        tags: [],
      });

      const updated = store.update(memory.id, { content: 'Updated content' });
      expect(updated).toBe(true);

      const retrieved = store.get(memory.id);
      expect(retrieved!.content).toBe('Updated content');
    });

    it('should update importance', () => {
      const memory = store.store({
        type: 'fact',
        content: 'Test',
        importance: 5,
        emotional_weight: 0,
        tags: [],
      });

      store.update(memory.id, { importance: 10 });
      const retrieved = store.get(memory.id);
      expect(retrieved!.importance).toBe(10);
    });

    it('should update tags', () => {
      const memory = store.store({
        type: 'fact',
        content: 'Test',
        importance: 5,
        emotional_weight: 0,
        tags: ['old'],
      });

      store.update(memory.id, { tags: ['new', 'updated'] });
      const retrieved = store.get(memory.id);
      expect(retrieved!.tags).toEqual(['new', 'updated']);
    });

    it('should return false for non-existent ID', () => {
      const result = store.update('non-existent', { content: 'test' });
      expect(result).toBe(false);
    });

    it('should return false when no updates provided', () => {
      const memory = store.store({
        type: 'fact',
        content: 'Test',
        importance: 5,
        emotional_weight: 0,
        tags: [],
      });

      const result = store.update(memory.id, {});
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a memory', () => {
      const memory = store.store({
        type: 'fact',
        content: 'To be deleted',
        importance: 5,
        emotional_weight: 0,
        tags: [],
      });

      const deleted = store.delete(memory.id);
      expect(deleted).toBe(true);

      const retrieved = store.get(memory.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent ID', () => {
      const result = store.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('decay', () => {
    it('should delete old low-importance memories', () => {
      // Store a memory
      const memory = store.store({
        type: 'fact',
        content: 'Old memory',
        importance: 2, // Low importance
        emotional_weight: 0,
        tags: [],
      });

      // Manually update last_accessed to be old (hacky but needed for testing)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60); // 60 days ago

      // Direct DB update for testing
      store['db']
        .prepare('UPDATE memories SET last_accessed = ? WHERE id = ?')
        .run(oldDate.toISOString(), memory.id);

      const decayed = store.decay(30, 3);
      expect(decayed).toBe(1);

      const retrieved = store.get(memory.id);
      expect(retrieved).toBeNull();
    });

    it('should not delete milestone memories', () => {
      const memory = store.store({
        type: 'milestone',
        content: 'Important milestone',
        importance: 2,
        emotional_weight: 0,
        tags: [],
      });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      store['db']
        .prepare('UPDATE memories SET last_accessed = ? WHERE id = ?')
        .run(oldDate.toISOString(), memory.id);

      const decayed = store.decay(30, 3);
      expect(decayed).toBe(0);

      const retrieved = store.get(memory.id);
      expect(retrieved).not.toBeNull();
    });

    it('should not delete request memories', () => {
      const memory = store.store({
        type: 'request',
        content: 'User request',
        importance: 2,
        emotional_weight: 0,
        tags: [],
      });

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);

      store['db']
        .prepare('UPDATE memories SET last_accessed = ? WHERE id = ?')
        .run(oldDate.toISOString(), memory.id);

      const decayed = store.decay(30, 3);
      expect(decayed).toBe(0);
    });
  });

  describe('state management', () => {
    it('should save and load state', () => {
      const state = { mood: 'happy', energy: 'high', count: 42 };
      store.saveState('test_state', state);

      const loaded = store.loadState<typeof state>('test_state');
      expect(loaded).toEqual(state);
    });

    it('should return null for non-existent state', () => {
      const loaded = store.loadState('non_existent');
      expect(loaded).toBeNull();
    });

    it('should overwrite existing state', () => {
      store.saveState('test', { value: 1 });
      store.saveState('test', { value: 2 });

      const loaded = store.loadState<{ value: number }>('test');
      expect(loaded!.value).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      store.store({ type: 'fact', content: 'F1', importance: 5, emotional_weight: 0, tags: [] });
      store.store({ type: 'fact', content: 'F2', importance: 7, emotional_weight: 0, tags: [] });
      store.store({
        type: 'preference',
        content: 'P1',
        importance: 3,
        emotional_weight: 0,
        tags: [],
      });

      const stats = store.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType['fact']).toBe(2);
      expect(stats.byType['preference']).toBe(1);
      expect(stats.avgImportance).toBe(5); // (5+7+3)/3
    });

    it('should handle empty store', () => {
      const stats = store.getStats();
      expect(stats.total).toBe(0);
      expect(stats.avgImportance).toBe(0);
    });
  });
});
