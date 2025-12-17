// Nexi Memory Store - SQLite-backed persistent memory

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryType, MemoryQuery } from '../types/index.js';
import path from 'path';
import fs from 'fs';

export class MemoryStore {
  private db: Database.Database;

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
        related_user TEXT
      )
    `);

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
   * Store a new memory
   */
  store(memory: Omit<Memory, 'id' | 'created_at' | 'last_accessed' | 'access_count'>): Memory {
    const now = new Date();
    const fullMemory: Memory = {
      ...memory,
      id: uuidv4(),
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
