import os
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "campus_market.db"
UPLOAD_DIR = BASE_DIR / "uploads" / "id_cards"
DATABASE_URL = os.environ.get("DATABASE_URL", "")


def use_postgres():
    return bool(DATABASE_URL)


def _pg_url():
    url = DATABASE_URL
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


class Database:
  def __init__(self, conn, is_postgres):
    self.conn = conn
    self.is_postgres = is_postgres

  def _sql(self, sql):
    if self.is_postgres:
      return sql
    return sql.replace("%s", "?")

  def execute(self, sql, params=None):
    cur = self.conn.cursor()
    cur.execute(self._sql(sql), params or ())
    return cur

  def fetchone(self, cur):
    row = cur.fetchone()
    if row is None:
      return None
    if self.is_postgres:
      return dict(row)
    return dict(row)

  def fetchall(self, cur):
    rows = cur.fetchall()
    if self.is_postgres:
      return [dict(r) for r in rows]
    return [dict(r) for r in rows]

  def commit(self):
    self.conn.commit()

  def close(self):
    self.conn.close()

  def insert_returning_id(self, sql, params):
    if self.is_postgres:
      cur = self.execute(sql.rstrip() + " RETURNING id", params)
      row = self.fetchone(cur)
      return row["id"] if row else None
    cur = self.execute(sql, params)
    return cur.lastrowid


def connect():
  if use_postgres():
    import psycopg2
    from psycopg2.extras import RealDictCursor

    conn = psycopg2.connect(_pg_url(), cursor_factory=RealDictCursor)
    return Database(conn, True)

  conn = sqlite3.connect(DB_PATH)
  conn.row_factory = sqlite3.Row
  return Database(conn, False)


def init_schema(db):
  if db.is_postgres:
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        roll_number TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        college_email TEXT NOT NULL UNIQUE,
        campus TEXT NOT NULL DEFAULT 'JKLU Campus',
        id_card_path TEXT NOT NULL,
        id_card_data BYTEA,
        email_verified INTEGER NOT NULL DEFAULT 0,
        id_verified INTEGER NOT NULL DEFAULT 0,
        created_at DOUBLE PRECISION NOT NULL
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        created_at DOUBLE PRECISION NOT NULL
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS otp_codes (
        college_email TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at DOUBLE PRECISION NOT NULL
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        seller_id INTEGER NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        category TEXT NOT NULL,
        condition TEXT NOT NULL,
        campus TEXT NOT NULL,
        emoji TEXT,
        image TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DOUBLE PRECISION NOT NULL
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES listings(id),
        buyer_id INTEGER NOT NULL REFERENCES users(id),
        seller_id INTEGER NOT NULL REFERENCES users(id),
        created_at DOUBLE PRECISION NOT NULL,
        UNIQUE(listing_id, buyer_id)
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id),
        sender_id INTEGER NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at DOUBLE PRECISION NOT NULL
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES listings(id),
        buyer_id INTEGER NOT NULL REFERENCES users(id),
        seller_id INTEGER NOT NULL REFERENCES users(id),
        amount DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at DOUBLE PRECISION NOT NULL
      )
      """
    )
  else:
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        roll_number TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        college_email TEXT NOT NULL UNIQUE,
        campus TEXT NOT NULL DEFAULT 'JKLU Campus',
        id_card_path TEXT NOT NULL,
        id_card_data BLOB,
        email_verified INTEGER NOT NULL DEFAULT 0,
        id_verified INTEGER NOT NULL DEFAULT 0,
        created_at REAL NOT NULL
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at REAL NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS otp_codes (
        college_email TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at REAL NOT NULL
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        seller_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        condition TEXT NOT NULL,
        campus TEXT NOT NULL,
        emoji TEXT,
        image TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at REAL NOT NULL,
        FOREIGN KEY (seller_id) REFERENCES users(id)
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id TEXT NOT NULL,
        buyer_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        created_at REAL NOT NULL,
        UNIQUE(listing_id, buyer_id),
        FOREIGN KEY (listing_id) REFERENCES listings(id),
        FOREIGN KEY (buyer_id) REFERENCES users(id),
        FOREIGN KEY (seller_id) REFERENCES users(id)
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at REAL NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      )
      """
    )
    db.execute(
      """
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL,
        buyer_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at REAL NOT NULL,
        FOREIGN KEY (listing_id) REFERENCES listings(id),
        FOREIGN KEY (buyer_id) REFERENCES users(id),
        FOREIGN KEY (seller_id) REFERENCES users(id)
      )
      """
    )

  _ensure_id_card_column(db)
  db.commit()


def _ensure_id_card_column(db):
  if db.is_postgres:
    db.execute(
      """
      ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_data BYTEA
      """
    )
  else:
    cols = db.fetchall(db.execute("PRAGMA table_info(users)"))
    if not any(c["name"] == "id_card_data" for c in cols):
      db.execute("ALTER TABLE users ADD COLUMN id_card_data BLOB")
