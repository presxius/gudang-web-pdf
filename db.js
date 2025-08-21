const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbfile = path.join(__dirname, 'gudang.db');

const db = new sqlite3.Database(dbfile);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS barang (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT,
    stok INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS riwayat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barangId INTEGER,
    nama TEXT,
    jumlah INTEGER,
    tipe TEXT,
    waktu TEXT
  )`);

  // default admin (username: admin, password: admin123)
  db.get("SELECT * FROM users WHERE username = ?", ['admin'], (err, row) => {
    if (!row) {
      db.run("INSERT INTO users (username, password) VALUES (?,?)", ['admin', 'admin123']);
    }
  });
});

module.exports = db;
