import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.join(process.cwd(), "local.db");

// Fixed local user ID for single-user mode (no auth required)
export const LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      bio TEXT,
      job_title TEXT,
      company TEXT,
      industries TEXT DEFAULT '[]',
      goals TEXT DEFAULT '[]',
      what_i_offer TEXT,
      what_i_need TEXT,
      networking_style TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      role TEXT,
      linkedin_url TEXT,
      twitter_handle TEXT,
      location TEXT,
      industries TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      how_we_met TEXT,
      relationship_tier TEXT DEFAULT 'acquaintance',
      context_summary TEXT,
      last_interaction_at TEXT,
      next_followup_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      interaction_type TEXT DEFAULT 'meeting',
      occurred_at TEXT DEFAULT (datetime('now')),
      raw_notes TEXT,
      ai_summary TEXT,
      key_topics TEXT DEFAULT '[]',
      commitments_made TEXT DEFAULT '[]',
      follow_up_items TEXT DEFAULT '[]',
      sentiment TEXT,
      relationship_strength_delta INTEGER DEFAULT 0,
      calendar_event_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      contact_id TEXT,
      type TEXT DEFAULT 'follow_up',
      priority INTEGER DEFAULT 5,
      title TEXT,
      description TEXT,
      suggested_message TEXT,
      reasoning TEXT,
      status TEXT DEFAULT 'pending',
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS call_preps (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      calendar_event_id TEXT,
      meeting_purpose TEXT,
      contact_summary TEXT,
      agenda TEXT,
      potential_outcomes TEXT,
      full_document TEXT,
      status TEXT DEFAULT 'draft',
      meeting_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS relationship_graph (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      contact_a_id TEXT NOT NULL,
      contact_b_id TEXT NOT NULL,
      relationship_type TEXT,
      strength INTEGER DEFAULT 5,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contact_a_id) REFERENCES contacts(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_b_id) REFERENCES contacts(id) ON DELETE CASCADE,
      UNIQUE(user_id, contact_a_id, contact_b_id)
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_tier ON contacts(relationship_tier);
    CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_recommendations_user ON ai_recommendations(user_id);
    CREATE INDEX IF NOT EXISTS idx_recommendations_status ON ai_recommendations(status);
    CREATE INDEX IF NOT EXISTS idx_call_preps_user ON call_preps(user_id);
    CREATE INDEX IF NOT EXISTS idx_relationship_graph_user ON relationship_graph(user_id);
  `);
}

export function newId(): string {
  return crypto.randomUUID();
}

// Helper to parse JSON array columns from SQLite
export function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

// Helper to serialize array for SQLite storage
export function toJsonArray(arr: string[] | undefined | null): string {
  return JSON.stringify(arr || []);
}

// Transform a raw SQLite row into the expected API shape (parse JSON arrays)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformContact(row: Record<string, unknown>): any {
  if (!row) return null;
  return {
    ...row,
    industries: parseJsonArray(row.industries as string),
    tags: parseJsonArray(row.tags as string),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformProfile(row: Record<string, unknown>): any {
  if (!row) return null;
  return {
    ...row,
    industries: parseJsonArray(row.industries as string),
    goals: parseJsonArray(row.goals as string),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformInteraction(row: Record<string, unknown>): any {
  if (!row) return null;
  return {
    ...row,
    key_topics: parseJsonArray(row.key_topics as string),
    commitments_made: parseJsonArray(row.commitments_made as string),
    follow_up_items: parseJsonArray(row.follow_up_items as string),
  };
}
