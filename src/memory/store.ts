// Nexi Memory Store - SQLite-backed persistent memory

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryType, MemoryQuery } from '../types/index.js';
import path from 'path';
import fs from 'fs';

// Cosine similarity for vector comparison
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export class MemoryStore {
  private db: Database.Database;
  private embeddingGenerator: ((text: string) => Promise<number[]>) | null = null;

  constructor(dataDir: string) {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'nexi_memory.db');
    this.db = new Database(dbPath);

    this.initialize();
  }

  private initialize(): void {
    // Create memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        context TEXT,
        importance INTEGER DEFAULT 5,
        emotional_weight INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        last_accessed TEXT NOT NULL,
        access_count INTEGER DEFAULT 1,
        tags TEXT DEFAULT '[]',
        related_user TEXT,
        embedding TEXT
      )
    `);

    // Add embedding column if it doesn't exist (migration for existing DBs)
    try {
      this.db.exec('ALTER TABLE memories ADD COLUMN embedding TEXT');
    } catch {
      // Column already exists, ignore
    }

    // Create state table for persisting Nexi's state between sessions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create conversation history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        message_count INTEGER DEFAULT 0,
        summary TEXT
      )
    `);

    // Create index for faster searches
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
    `);
  }

  /**
   * Set the embedding generator function (typically from LLM provider)
   */
  setEmbeddingGenerator(generator: (text: string) => Promise<number[]>): void {
    this.embeddingGenerator = generator;
  }

  /**
   * Validate importance value (1-10)
   */
  private validateImportance(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) return 5;
    return Math.max(1, Math.min(10, Math.round(value)));
  }

  /**
   * Validate emotional weight value (-5 to 5)
   */
  private validateEmotionalWeight(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) return 0;
    return Math.max(-5, Math.min(5, Math.round(value)));
  }

  /**
   * Store a new memory
   */
  store(memory: Omit<Memory, 'id' | 'created_at' | 'last_accessed' | 'access_count'>): Memory {
    const now = new Date();
    const fullMemory: Memory = {
      ...memory,
      id: uuidv4(),
      importance: this.validateImportance(memory.importance),
      emotional_weight: this.validateEmotionalWeight(memory.emotional_weight),
      created_at: now,
      last_accessed: now,
      access_count: 1,
    };

    const stmt = this.db.prepare(`
      INSERT INTO memories (id, type, content, context, importance, emotional_weight, created_at, last_accessed, access_count, tags, related_user)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullMemory.id,
      fullMemory.type,
      fullMemory.content,
      fullMemory.context ?? null,
      fullMemory.importance,
      fullMemory.emotional_weight,
      fullMemory.created_at.toISOString(),
      fullMemory.last_accessed.toISOString(),
      fullMemory.access_count,
      JSON.stringify(fullMemory.tags),
      fullMemory.related_user ?? null
    );

    return fullMemory;
  }

  /**
   * Query memories based on criteria
   */
  query(query: MemoryQuery): Memory[] {
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params: any[] = [];

    if (query.type) {
      sql += ' AND type = ?';
      params.push(query.type);
    }

    if (query.minImportance) {
      sql += ' AND importance >= ?';
      params.push(query.minImportance);
    }

    if (query.search) {
      sql += ' AND (content LIKE ? OR context LIKE ?)';
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (query.tags && query.tags.length > 0) {
      // SQLite JSON search
      const tagConditions = query.tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      query.tags.forEach((tag) => params.push(`%"${tag}"%`));
    }

    sql += ' ORDER BY importance DESC, last_accessed DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    // Update access count and last_accessed for retrieved memories
    const updateStmt = this.db.prepare(`
      UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?
    `);

    const now = new Date().toISOString();
    return rows.map((row) => {
      updateStmt.run(now, row.id);
      return this.rowToMemory(row);
    });
  }

  /**
   * Get memories relevant to a given text (simple keyword matching for now)
   * Can be enhanced with vector embeddings later
   */
  findRelevant(text: string, limit: number = 5): Memory[] {
    // Extract keywords (simple approach - can be improved)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    if (words.length === 0) {
      // Return recent important memories if no keywords
      return this.query({ minImportance: 6, limit });
    }

    // Search for memories matching any keyword
    const conditions = words
      .map(() => '(LOWER(content) LIKE ? OR LOWER(context) LIKE ?)')
      .join(' OR ');
    const params: string[] = [];
    words.forEach((word) => {
      params.push(`%${word}%`, `%${word}%`);
    });

    const sql = `
      SELECT *,
        (importance * 2 + access_count) as relevance_score
      FROM memories
      WHERE ${conditions}
      ORDER BY relevance_score DESC
      LIMIT ?
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params, limit) as any[];

    return rows.map((row) => this.rowToMemory(row));
  }

  /**
   * Store a memory with embedding for semantic search
   */
  async storeWithEmbedding(
    memory: Omit<Memory, 'id' | 'created_at' | 'last_accessed' | 'access_count'>
  ): Promise<Memory> {
    const now = new Date();
    const fullMemory: Memory = {
      ...memory,
      id: uuidv4(),
      importance: this.validateImportance(memory.importance),
      emotional_weight: this.validateEmotionalWeight(memory.emotional_weight),
      created_at: now,
      last_accessed: now,
      access_count: 1,
    };

    let embedding: number[] | null = null;
    if (this.embeddingGenerator) {
      try {
        embedding = await this.embeddingGenerator(memory.content);
      } catch {
        // Embedding failed, store without it
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO memories (id, type, content, context, importance, emotional_weight, created_at, last_accessed, access_count, tags, related_user, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullMemory.id,
      fullMemory.type,
      fullMemory.content,
      fullMemory.context ?? null,
      fullMemory.importance,
      fullMemory.emotional_weight,
      fullMemory.created_at.toISOString(),
      fullMemory.last_accessed.toISOString(),
      fullMemory.access_count,
      JSON.stringify(fullMemory.tags),
      fullMemory.related_user ?? null,
      embedding ? JSON.stringify(embedding) : null
    );

    return fullMemory;
  }

  /**
   * Find relevant memories using semantic similarity (vector embeddings)
   * Falls back to keyword search if embeddings are unavailable
   */
  async findRelevantSemantic(text: string, limit: number = 5): Promise<Memory[]> {
    // If no embedding generator, fall back to keyword search
    if (!this.embeddingGenerator) {
      return this.findRelevant(text, limit);
    }

    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingGenerator(text);
    } catch {
      // Embedding failed, fall back to keyword search
      return this.findRelevant(text, limit);
    }

    // Get all memories with embeddings
    const rows = this.db
      .prepare('SELECT * FROM memories WHERE embedding IS NOT NULL')
      .all() as any[];

    // Calculate similarity scores
    const scored = rows
      .map((row) => {
        const embedding = JSON.parse(row.embedding) as number[];
        const similarity = cosineSimilarity(queryEmbedding, embedding);
        return { row, similarity };
      })
      .filter((item) => item.similarity > 0.3) // Threshold for relevance
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // If no semantic matches, fall back to keyword search
    if (scored.length === 0) {
      return this.findRelevant(text, limit);
    }

    return scored.map((item) => this.rowToMemory(item.row));
  }

  /**
   * Get a specific memory by ID
   */
  get(id: string): Memory | null {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    // Update access tracking
    const updateStmt = this.db.prepare(`
      UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?
    `);
    updateStmt.run(new Date().toISOString(), id);

    return this.rowToMemory(row);
  }

  /**
   * Update an existing memory
   */
  update(
    id: string,
    updates: Partial<
      Pick<Memory, 'content' | 'context' | 'importance' | 'emotional_weight' | 'tags'>
    >
  ): boolean {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.content !== undefined) {
      setClauses.push('content = ?');
      params.push(updates.content);
    }
    if (updates.context !== undefined) {
      setClauses.push('context = ?');
      params.push(updates.context);
    }
    if (updates.importance !== undefined) {
      setClauses.push('importance = ?');
      params.push(updates.importance);
    }
    if (updates.emotional_weight !== undefined) {
      setClauses.push('emotional_weight = ?');
      params.push(updates.emotional_weight);
    }
    if (updates.tags !== undefined) {
      setClauses.push('tags = ?');
      params.push(JSON.stringify(updates.tags));
    }

    if (setClauses.length === 0) return false;

    params.push(id);
    const sql = `UPDATE memories SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = this.db.prepare(sql).run(...params);

    return result.changes > 0;
  }

  /**
   * Delete a memory
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Forget old, low-importance memories (memory decay)
   */
  decay(daysOld: number = 30, maxImportance: number = 3): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = this.db
      .prepare(
        `
      DELETE FROM memories
      WHERE last_accessed < ?
        AND importance <= ?
        AND type NOT IN ('milestone', 'request')
    `
      )
      .run(cutoffDate.toISOString(), maxImportance);

    return result.changes;
  }

  /**
   * Find potential duplicate memories using text similarity
   */
  findDuplicates(similarityThreshold: number = 0.8): Array<{ original: Memory; duplicate: Memory; similarity: number }> {
    const allMemories = this.db.prepare('SELECT * FROM memories ORDER BY created_at ASC').all() as any[];
    const duplicates: Array<{ original: Memory; duplicate: Memory; similarity: number }> = [];

    for (let i = 0; i < allMemories.length; i++) {
      for (let j = i + 1; j < allMemories.length; j++) {
        const similarity = this.textSimilarity(allMemories[i].content, allMemories[j].content);

        if (similarity >= similarityThreshold) {
          duplicates.push({
            original: this.rowToMemory(allMemories[i]),
            duplicate: this.rowToMemory(allMemories[j]),
            similarity,
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Remove duplicate memories, keeping the one with higher importance
   * Returns the number of removed duplicates
   */
  deduplicate(similarityThreshold: number = 0.8): number {
    const duplicates = this.findDuplicates(similarityThreshold);
    let removed = 0;

    for (const { original, duplicate } of duplicates) {
      // Keep the memory with higher importance (or original if equal)
      const toDelete = original.importance >= duplicate.importance ? duplicate : original;
      const toKeep = original.importance >= duplicate.importance ? original : duplicate;

      // Merge tags
      const mergedTags = [...new Set([...toKeep.tags, ...toDelete.tags])];
      this.update(toKeep.id, { tags: mergedTags });

      // Delete the duplicate
      if (this.delete(toDelete.id)) {
        removed++;
      }
    }

    return removed;
  }

  /**
   * Calculate text similarity using Jaccard index on word sets
   */
  private textSimilarity(text1: string, text2: string): number {
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2);

    const words1 = new Set(normalize(text1));
    const words2 = new Set(normalize(text2));

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Save arbitrary state
   */
  saveState(key: string, value: any): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO state (key, value, updated_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(key, JSON.stringify(value), new Date().toISOString());
  }

  /**
   * Load saved state
   */
  loadState<T>(key: string): T | null {
    const stmt = this.db.prepare('SELECT value FROM state WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;

    if (!row) return null;
    return JSON.parse(row.value) as T;
  }

  /**
   * Get memory statistics
   */
  getStats(): { total: number; byType: Record<string, number>; avgImportance: number } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as any).count;

    const byTypeRows = this.db
      .prepare(
        `
      SELECT type, COUNT(*) as count FROM memories GROUP BY type
    `
      )
      .all() as { type: string; count: number }[];

    const byType: Record<string, number> = {};
    byTypeRows.forEach((row) => {
      byType[row.type] = row.count;
    });

    const avgResult = this.db.prepare('SELECT AVG(importance) as avg FROM memories').get() as any;
    const avgImportance = avgResult.avg ?? 0;

    return { total, byType, avgImportance };
  }

  /**
   * Convert database row to Memory object
   */
  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      type: row.type as MemoryType,
      content: row.content,
      context: row.context ?? undefined,
      importance: row.importance,
      emotional_weight: row.emotional_weight,
      created_at: new Date(row.created_at),
      last_accessed: new Date(row.last_accessed),
      access_count: row.access_count,
      tags: JSON.parse(row.tags || '[]'),
      related_user: row.related_user ?? undefined,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
