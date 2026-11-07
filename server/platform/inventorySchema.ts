import type Database from 'better-sqlite3';
// Additive extension: original v1 tables and rows stay unchanged.
export function initializeInventory(db: Database.Database) {
  if (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_schema_version'",
      )
      .get()
  ) {
    const current = db
      .prepare('SELECT MAX(version) AS version FROM inventory_schema_version')
      .get() as { version: number };
    if (current.version !== 1) throw new Error('Versión de inventario incompatible');
  }
  db.transaction(() =>
    db.exec(`
 CREATE TABLE IF NOT EXISTS inventory_schema_version(version INTEGER PRIMARY KEY CHECK(version=1));
 INSERT OR IGNORE INTO inventory_schema_version VALUES(1);
 CREATE TABLE IF NOT EXISTS inventory_config(project_id TEXT PRIMARY KEY REFERENCES projects(id),entity_id TEXT NOT NULL REFERENCES entities(id),definition TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS application_members(project_id TEXT NOT NULL REFERENCES projects(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('admin','operator','viewer')),PRIMARY KEY(project_id,user_id));
 CREATE TABLE IF NOT EXISTS application_invitations(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','operator','viewer')),token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS inventory_minimums(project_id TEXT NOT NULL REFERENCES projects(id),product_id TEXT NOT NULL REFERENCES records(id),minimum INTEGER NOT NULL CHECK(minimum>=0),revision INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(project_id,product_id));
 CREATE TABLE IF NOT EXISTS inventory_movements(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),product_id TEXT NOT NULL REFERENCES records(id),operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,data TEXT NOT NULL,delta INTEGER NOT NULL,created_at TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),UNIQUE(project_id,operation_id));
 CREATE INDEX IF NOT EXISTS inventory_product ON inventory_movements(project_id,product_id);
 CREATE INDEX IF NOT EXISTS inventory_history ON inventory_movements(project_id,created_at DESC);
 CREATE TRIGGER IF NOT EXISTS inventory_immutable_update BEFORE UPDATE ON inventory_movements BEGIN SELECT RAISE(ABORT,'Los movimientos confirmados son inmutables'); END;
 CREATE TRIGGER IF NOT EXISTS inventory_immutable_delete BEFORE DELETE ON inventory_movements BEGIN SELECT RAISE(ABORT,'Los movimientos confirmados son inmutables'); END;
 `),
  ).immediate();
}
