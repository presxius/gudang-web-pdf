const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'gudang_secret_2025',
  resave: false,
  saveUninitialized: true,
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {
    if (err) return res.status(500).json({ error: 'db error' });
    if (!row) return res.status(401).json({ error: 'invalid credentials' });
    req.session.user = { username: row.username };
    res.json({ ok: true, username: row.username });
  });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Middleware: check session for APIs we want protected (optional)
function requireAuth(req, res, next) {
  next();
}

// Get barang
app.get('/api/barang', requireAuth, (req, res) => {
  db.all("SELECT * FROM barang ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db error' });
    res.json(rows);
  });
});

// Tambah barang
app.post('/tambah', requireAuth, (req, res) => {
  const { nama, stok } = req.body;
  const s = Number(stok) || 0;
  db.run("INSERT INTO barang (nama, stok) VALUES (?,?)", [nama, s], function(err) {
    if (err) return res.status(500).json({ error: 'db error' });
    res.json({ ok: true, id: this.lastID });
  });
});

// Transaksi (masuk/keluar)
app.post('/transaksi', requireAuth, (req, res) => {
  const { id, jumlah, tipe } = req.body;
  const j = Number(jumlah) || 0;
  db.get("SELECT * FROM barang WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'db error' });
    if (!row) return res.status(404).json({ error: 'barang not found' });
    let newstok = row.stok;
    if (tipe === 'masuk') newstok = row.stok + j;
    else newstok = Math.max(0, row.stok - j);
    db.run("UPDATE barang SET stok = ? WHERE id = ?", [newstok, id], function(err2) {
      if (err2) return res.status(500).json({ error: 'db error' });
      const waktu = new Date().toISOString();
      db.run("INSERT INTO riwayat (barangId,nama,jumlah,tipe,waktu) VALUES (?,?,?,?,?)", [row.id, row.nama, j, tipe, waktu], function(err3) {
        if (err3) return res.status(500).json({ error: 'db error' });
        res.json({ ok: true });
      });
    });
  });
});

// Get riwayat
app.get('/api/riwayat', requireAuth, (req, res) => {
  db.all("SELECT * FROM riwayat ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db error' });
    res.json(rows);
  });
});

// Fallback to serve index.html (for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
