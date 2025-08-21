// Ganti endpoint /login
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

// Ganti endpoint /api/barang
app.get('/api/barang', requireAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM barang ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});

// Ganti endpoint /tambah
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

// Ganti endpoint /tambah
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

// Ganti endpoint /transaksi
app.post('/transaksi', requireAuth, async (req, res) => {
  const { id, jumlah, tipe } = req.body;
  const j = Number(jumlah) || 0;

  try {
    // Ambil data barang
    const barangResult = await db.query("SELECT * FROM barang WHERE id = $1", [id]);
    if (barangResult.rows.length === 0) {
      return res.status(404).json({ error: 'barang not found' });
    }
    const row = barangResult.rows[0];

    // Hitung stok baru
    let newstok = row.stok;
    if (tipe === 'masuk') {
      newstok += j;
    } else {
      newstok = Math.max(0, row.stok - j);
    }

    // Update stok barang
    await db.query("UPDATE barang SET stok = $1 WHERE id = $2", [newstok, id]);

    // Catat riwayat
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

// Ganti endpoint /api/riwayat
app.get('/api/riwayat', requireAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM riwayat ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db error' });
  }
});
