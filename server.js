// ===============================================
// 1. IMPOR SEMUA MODUL YANG DIBUTUHKAN
// ===============================================
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const db = require('./db'); // Ini mengimpor koneksi Supabase dari db.js

// ===============================================
// 2. INISIALISASI APLIKASI EXPRESS
// ===============================================
const app = express(); // <-- Ini baris penting yang hilang
const PORT = 3000;

// ===============================================
// 3. KONFIGURASI MIDDLEWARE
// ===============================================
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'gudang_secret_2025',
  resave: false,
  saveUninitialized: true,
}));

// Serve static frontend dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Middleware: check session (tidak melakukan apa-apa, tapi dibutuhkan agar tidak error)
function requireAuth(req, res, next) {
  next();
}

// ===============================================
// 4. RUTE-RUTE API ANDA
// ===============================================

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query(
      "SELECT * FROM users WHERE username = $1 AND password = $2",
      [username, password]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const user = result.rows[0];
    req.session.user = { username: user.username };
    res.json({ ok: true, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Get barang
app.get('/api/barang', requireAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM barang ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Tambah barang (Saya sudah hapus duplikasinya)
app.post('/tambah', requireAuth, async (req, res) => {
  const { nama, stok } = req.body;
  const s = Number(stok) || 0;
  try {
    const result = await db.query(
      "INSERT INTO barang (nama, stok) VALUES ($1, $2) RETURNING id",
      [nama, s]
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Transaksi (masuk/keluar)
app.post('/transaksi', requireAuth, async (req, res) => {
  const { id, jumlah, tipe } = req.body;
  const j = Number(jumlah) || 0;

  try {
    const barangResult = await db.query("SELECT * FROM barang WHERE id = $1", [id]);
    if (barangResult.rows.length === 0) {
      return res.status(404).json({ error: 'barang not found' });
    }
    const row = barangResult.rows[0];

    let newstok = row.stok;
    if (tipe === 'masuk') {
      newstok += j;
    } else {
      newstok = Math.max(0, row.stok - j);
    }

    await db.query("UPDATE barang SET stok = $1 WHERE id = $2", [newstok, id]);

    const waktu = new Date().toISOString();
    await db.query(
      "INSERT INTO riwayat (barangId, nama, jumlah, tipe, waktu) VALUES ($1, $2, $3, $4, $5)",
      [row.id, row.nama, j, tipe, waktu]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Get riwayat
app.get('/api/riwayat', requireAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM riwayat ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// ===============================================
// 5. FALLBACK & EXPORT
// ===============================================

// Fallback untuk SPA (Single Page Application)
// Ini akan mengirim index.html untuk semua rute yang tidak cocok di atas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jalankan server (hanya untuk development lokal, Vercel akan mengabaikan ini)
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

// Export aplikasi untuk Vercel
module.exports = app;
