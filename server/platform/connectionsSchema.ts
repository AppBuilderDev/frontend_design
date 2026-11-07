import type Database from 'better-sqlite3';
export function initializeConnections(db: Database.Database) {
  if (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='connections_schema_version'",
      )
      .get() &&
    (db.prepare('SELECT MAX(version) AS v FROM connections_schema_version').get() as { v: number })
      .v !== 1
  )
    throw new Error('Versión de conexiones incompatible');
  db.transaction(() =>
    db.exec(`
 CREATE TABLE IF NOT EXISTS connections_schema_version(version INTEGER PRIMARY KEY CHECK(version=1));INSERT OR IGNORE INTO connections_schema_version VALUES(1);
 CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),key TEXT NOT NULL,draft TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,published_version INTEGER NOT NULL DEFAULT 0,UNIQUE(project_id,key));
 CREATE TABLE IF NOT EXISTS connection_versions(connection_id TEXT NOT NULL REFERENCES connections(id),version INTEGER NOT NULL,definition TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(connection_id,version));
 CREATE TABLE IF NOT EXISTS connection_environments(connection_id TEXT NOT NULL REFERENCES connections(id),environment TEXT NOT NULL CHECK(environment IN ('test','production')),revision INTEGER NOT NULL,origin TEXT NOT NULL,path TEXT NOT NULL,auth TEXT NOT NULL,header_name TEXT NOT NULL,secret TEXT,PRIMARY KEY(connection_id,environment));
 CREATE TABLE IF NOT EXISTS connection_checks(connection_id TEXT NOT NULL REFERENCES connections(id),environment TEXT NOT NULL,environment_revision INTEGER NOT NULL,definition_hash TEXT NOT NULL,checked_at INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('ok','failed')),PRIMARY KEY(connection_id,environment,environment_revision,definition_hash));
 CREATE TABLE IF NOT EXISTS connection_events(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL REFERENCES projects(id),connection_id TEXT NOT NULL REFERENCES connections(id),actor_id TEXT NOT NULL REFERENCES users(id),environment TEXT NOT NULL,version INTEGER NOT NULL,status INTEGER NOT NULL,duration_ms INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS connection_event_scope ON connection_events(project_id,connection_id,id DESC);
 CREATE TRIGGER IF NOT EXISTS connection_version_immutable_update BEFORE UPDATE ON connection_versions BEGIN SELECT RAISE(ABORT,'El contrato de conexión publicado es inmutable');END;
 CREATE TRIGGER IF NOT EXISTS connection_version_immutable_delete BEFORE DELETE ON connection_versions BEGIN SELECT RAISE(ABORT,'El contrato de conexión publicado es inmutable');END;
 `),
  ).immediate();
}
