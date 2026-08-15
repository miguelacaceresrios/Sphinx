import Database from "better-sqlite3";

// Sin WAL: todo se escribe directo en el archivo .db, sin un -wal aparte.
// Así el archivo commiteado a git siempre tiene todo, sin depender de un checkpoint previo.
const db = new Database("data/recursos.db");

db.exec(`
CREATE TABLE IF NOT EXISTS recursos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  canal TEXT NOT NULL,
  nombre_archivo TEXT,
  caption TEXT,
  tipo TEXT,
  hash TEXT,
  resumen TEXT,
  categoria TEXT,
  fecha_mensaje TEXT,
  link_mensaje TEXT,
  UNIQUE(message_id, canal)
);

CREATE TABLE IF NOT EXISTS estado_indexado (
  canal TEXT PRIMARY KEY,
  ultimo_message_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bot_estado (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`);

export function getUltimoMessageId(canal) {
  const row = db.prepare("SELECT ultimo_message_id FROM estado_indexado WHERE canal = ?").get(canal);
  return row ? row.ultimo_message_id : 0;
}

export function setUltimoMessageId(canal, id) {
  db.prepare(`
    INSERT INTO estado_indexado (canal, ultimo_message_id) VALUES (?, ?)
    ON CONFLICT(canal) DO UPDATE SET ultimo_message_id = excluded.ultimo_message_id
  `).run(canal, id);
}

export function existeHash(hash) {
  if (!hash) return null;
  return db.prepare("SELECT id, nombre_archivo FROM recursos WHERE hash = ?").get(hash);
}

export function guardarRecurso(r) {
  db.prepare(`
    INSERT OR IGNORE INTO recursos
      (message_id, canal, nombre_archivo, caption, tipo, hash, resumen, categoria, fecha_mensaje, link_mensaje)
    VALUES (@message_id, @canal, @nombre_archivo, @caption, @tipo, @hash, @resumen, @categoria, @fecha_mensaje, @link_mensaje)
  `).run(r);
}

export function buscarRecursos(query, limite = 15) {
  const like = `%${query}%`;
  return db.prepare(`
    SELECT * FROM recursos
    WHERE nombre_archivo LIKE ? OR caption LIKE ? OR resumen LIKE ? OR categoria LIKE ?
    ORDER BY id DESC LIMIT ?
  `).all(like, like, like, like, limite);
}

export function listarTodo(limite = 50) {
  return db.prepare("SELECT * FROM recursos ORDER BY id DESC LIMIT ?").all(limite);
}

export function contarRecursos() {
  return db.prepare("SELECT COUNT(*) as total FROM recursos").get().total;
}

export function getUltimoUpdateId() {
  const row = db.prepare("SELECT valor FROM bot_estado WHERE clave = 'ultimo_update_id'").get();
  return row ? Number(row.valor) : 0;
}

export function setUltimoUpdateId(id) {
  db.prepare(`
    INSERT INTO bot_estado (clave, valor) VALUES ('ultimo_update_id', ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor
  `).run(String(id));
}

export default db;
