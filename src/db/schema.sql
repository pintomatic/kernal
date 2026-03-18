-- Kernal Schema v1

CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  industry TEXT,
  type TEXT CHECK(type IN ('client','partner','prospect','employer','other')),
  website TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT,
  org_id INTEGER REFERENCES organizations(id),
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('meeting','call','email','event','intro','other')),
  title TEXT,
  date TEXT,
  summary TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  due_date TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open','done','cancelled')),
  owner_id INTEGER REFERENCES people(id),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  relation TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_type, source_id, target_type, target_id, relation)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_people_org ON people(org_id);
CREATE INDEX IF NOT EXISTS idx_orgs_name ON organizations(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_type, target_id);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS people_fts USING fts5(name, role, notes, content=people, content_rowid=id);
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(content, content=notes, content_rowid=id);

-- FTS triggers for people
CREATE TRIGGER IF NOT EXISTS people_ai AFTER INSERT ON people BEGIN
  INSERT INTO people_fts(rowid, name, role, notes) VALUES (new.id, new.name, new.role, new.notes);
END;
CREATE TRIGGER IF NOT EXISTS people_ad AFTER DELETE ON people BEGIN
  INSERT INTO people_fts(people_fts, rowid, name, role, notes) VALUES('delete', old.id, old.name, old.role, old.notes);
END;
CREATE TRIGGER IF NOT EXISTS people_au AFTER UPDATE ON people BEGIN
  INSERT INTO people_fts(people_fts, rowid, name, role, notes) VALUES('delete', old.id, old.name, old.role, old.notes);
  INSERT INTO people_fts(rowid, name, role, notes) VALUES (new.id, new.name, new.role, new.notes);
END;

-- FTS triggers for notes
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO notes_fts(rowid, content) VALUES (new.id, new.content);
END;
