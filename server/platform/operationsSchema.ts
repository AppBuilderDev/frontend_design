import type Database from 'better-sqlite3';
export function initializeOperations(db: Database.Database) {
  const exists = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='operations_schema_version'",
    )
    .get();
  if (
    exists &&
    (db.prepare('SELECT MAX(version) AS v FROM operations_schema_version').get() as { v: number })
      .v !== 1
  )
    throw new Error('Versión de servicios incompatible');
  db.transaction(() =>
    db.exec(`
 CREATE TABLE IF NOT EXISTS operations_schema_version(version INTEGER PRIMARY KEY CHECK(version=1));INSERT OR IGNORE INTO operations_schema_version VALUES(1);
 CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),key TEXT NOT NULL,draft TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,published_version INTEGER NOT NULL DEFAULT 0,UNIQUE(project_id,key));
 CREATE TABLE IF NOT EXISTS operation_versions(service_id TEXT NOT NULL REFERENCES operations(id),version INTEGER NOT NULL,definition TEXT NOT NULL,entities TEXT NOT NULL,created_at TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(service_id,version));
 CREATE TABLE IF NOT EXISTS operation_runs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),service_id TEXT NOT NULL REFERENCES operations(id),version INTEGER NOT NULL,operation_id TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),request_hash TEXT NOT NULL,result TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(project_id,operation_id),FOREIGN KEY(service_id,version) REFERENCES operation_versions(service_id,version));
 CREATE INDEX IF NOT EXISTS operation_run_scope ON operation_runs(project_id,service_id,created_at DESC);
 CREATE TRIGGER IF NOT EXISTS operation_version_immutable_update BEFORE UPDATE ON operation_versions BEGIN SELECT RAISE(ABORT,'La versión publicada es inmutable');END;
 CREATE TRIGGER IF NOT EXISTS operation_version_immutable_delete BEFORE DELETE ON operation_versions BEGIN SELECT RAISE(ABORT,'La versión publicada es inmutable');END;
 `),
  ).immediate();
}
