(function(){
  const ROOT = document.getElementById('root');
  const BASE = '';
  const LOW_THRESHOLD = 5;
  function el(html){ const div=document.createElement('div'); div.innerHTML=html.trim(); return div.firstChild; }
  function q(sel, ctx=document){ return ctx.querySelector(sel); }
  function fmtDate(iso){ try{ return new Date(iso).toLocaleString(); }catch(e){return iso;} }

  async function post(url, body){
    try {
      const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      return await res.json();
    } catch(e) { throw e; }
  }
  async function get(url){
    try {
      const res = await fetch(url);
      return await res.json();
    } catch(e){
      throw e;
    }
  }

  const LS_KEYS = { users:'gudang_users_v1', barang:'gudang_barang_v1', riwayat:'gudang_riwayat_v1', session:'gudang_session_v1' };
  function initLS(){ if(!localStorage.getItem(LS_KEYS.users)) localStorage.setItem(LS_KEYS.users, JSON.stringify([{id:1,username:'admin',password:'admin123'}])); if(!localStorage.getItem(LS_KEYS.barang)) localStorage.setItem(LS_KEYS.barang, JSON.stringify([])); if(!localStorage.getItem(LS_KEYS.riwayat)) localStorage.setItem(LS_KEYS.riwayat, JSON.stringify([])); }
  initLS();

  function apiGetBarangLS(){ return JSON.parse(localStorage.getItem(LS_KEYS.barang)||'[]'); }
  function apiTambahBarangLS({nama,stok}){ const list = apiGetBarangLS(); const id = list.length ? Math.max(...list.map(b=>b.id))+1 : 1; list.push({id, nama, stok: Number(stok)}); localStorage.setItem(LS_KEYS.barang, JSON.stringify(list)); }
  function apiTransaksiLS({id,jumlah,tipe}){ const list = apiGetBarangLS(); const idx = list.findIndex(b=>b.id===Number(id)); if(idx===-1) throw new Error('not found'); const b = list[idx]; if(tipe==='masuk') b.stok = Number(b.stok) + Number(jumlah); else b.stok = Math.max(0, Number(b.stok) - Number(jumlah)); list[idx] = b; localStorage.setItem(LS_KEYS.barang, JSON.stringify(list)); const hist = JSON.parse(localStorage.getItem(LS_KEYS.riwayat)||'[]'); hist.unshift({ id: hist.length ? Math.max(...hist.map(h=>h.id))+1 : 1, barangId: b.id, nama: b.nama, jumlah: Number(jumlah), tipe, waktu: new Date().toISOString() }); localStorage.setItem(LS_KEYS.riwayat, JSON.stringify(hist)); }
  function apiGetRiwayatLS(){ return JSON.parse(localStorage.getItem(LS_KEYS.riwayat)||'[]'); }
  async function apiLoginLS(username,password){ const users = JSON.parse(localStorage.getItem(LS_KEYS.users)||'[]'); const u = users.find(x=>x.username===username && x.password===password); if(!u) throw new Error('invalid creds'); localStorage.setItem(LS_KEYS.session, JSON.stringify({username})); return {username}; }

  let state = { user:null, barang:[], riwayat:[], mode:'Backend' };

  async function tryLogin(username,password){
    try {
      const res = await post('/login', { username, password });
      if (res && res.ok) { state.user = res.username || username; state.mode = 'Backend'; localStorage.setItem(LS_KEYS.session, JSON.stringify({username: state.user})); return; }
    } catch(e){ }
    // fallback local
    const r = await apiLoginLS(username,password);
    state.user = r.username;
    state.mode = 'Local';
    localStorage.setItem(LS_KEYS.session, JSON.stringify({username: state.user}));
  }

  async function tryFetchData(){
    try {
      const b = await get('/api/barang');
      const r = await get('/api/riwayat');
      state.barang = b;
      state.riwayat = r;
      state.mode = 'Backend';
    } catch(e) {
      state.barang = apiGetBarangLS();
      state.riwayat = apiGetRiwayatLS();
      state.mode = 'Local';
    }
  }

  async function tryTambah(nama,stok){
    try { await post('/tambah', { nama, stok }); state.mode='Backend'; }
    catch(e){ apiTambahBarangLS({nama, stok}); state.mode='Local'; }
    await tryFetchData();
    renderApp();
  }

  async function tryTransaksi(id,jumlah,tipe){
    try { await post('/transaksi', { id, jumlah, tipe }); state.mode='Backend'; }
    catch(e){ apiTransaksiLS({ id, jumlah, tipe }); state.mode='Local'; }
    await tryFetchData();
    renderApp();
  }

  function filteredRiwayat(start,end){
    const s = start ? new Date(start+'T00:00:00') : null;
    const e = end ? new Date(end+'T23:59:59') : null;
    return state.riwayat.filter(r=>{
      const t = new Date(r.waktu);
      if (s && t < s) return false;
      if (e && t > e) return false;
      return true;
    });
  }

  function exportRiwayatPDF(start,end){
    const rows = filteredRiwayat(start,end);
    if(!rows || rows.length===0){ alert('Tidak ada data untuk diekspor'); return; }
    // create printable HTML
    let html = `<html><head><title>Riwayat Transaksi</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}</style></head><body>`;
    html += `<h2>Riwayat Transaksi</h2>`;
    html += `<table><thead><tr><th>ID</th><th>Nama</th><th>Jumlah</th><th>Tipe</th><th>Waktu</th></tr></thead><tbody>`;
    rows.forEach(r=>{ html += `<tr><td>${r.id}</td><td>${r.nama}</td><td>${r.jumlah}</td><td>${r.tipe}</td><td>${new Date(r.waktu).toLocaleString()}</td></tr>`; });
    html += `</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    // give browser a moment then call print
    setTimeout(()=>{ w.print(); }, 500);
  }

  function exportBarangCSV(){
    if(!state.barang || state.barang.length===0){ alert('Tidak ada barang'); return; }
    const header = ['id','nama','stok'];
    const rows = state.barang.map(b=>[b.id,b.nama,b.stok]);
    const csv = [header.join(','), ...rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='barang.csv'; document.body.appendChild(a); a.click(); a.remove();
  }

  function exportRiwayatCSV(start,end){
    const rows = filteredRiwayat(start,end);
    if(!rows || rows.length===0){ alert('Tidak ada data'); return; }
    const header = ['id','nama','jumlah','tipe','waktu'];
    const lines = [header.join(','), ...rows.map(r=>[r.id,r.nama,r.jumlah,r.tipe,r.waktu].map(c=>`"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([lines], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='riwayat.csv'; document.body.appendChild(a); a.click(); a.remove();
  }

  async function runSelfTest(){
    if(!confirm('Self-test akan menghapus data lokal & membuat contoh. Lanjutkan?')) return;
    localStorage.setItem(LS_KEYS.barang, JSON.stringify([]));
    localStorage.setItem(LS_KEYS.riwayat, JSON.stringify([]));
    apiTambahBarangLS({ nama:'Obat A', stok:10 });
    apiTambahBarangLS({ nama:'Obat B', stok:2 });
    apiTransaksiLS({ id:1, jumlah:3, tipe:'keluar' });
    apiTransaksiLS({ id:2, jumlah:5, tipe:'masuk' });
    await tryFetchData();
    alert('Self-test selesai (cek tabel & riwayat).');
  }

  // UI rendering
  function renderLogin(){
    ROOT.innerHTML = '';
    const div = el(`<div class="container"><div class="card"><h2>Gudang Web</h2><p class="small">Login demo: admin / admin123</p><form id="loginForm" style="display:flex;gap:8px;align-items:center"><input id="u" placeholder="username"/><input id="p" type="password" placeholder="password"/><button type="submit">Login</button></form></div></div>`);
    ROOT.appendChild(div);
    q('#loginForm').addEventListener('submit', async (ev)=>{ ev.preventDefault(); try{ await tryLogin(q('#u').value.trim(), q('#p').value.trim()); await tryFetchData(); renderApp(); }catch(err){ alert('Login gagal'); } });
  }

  function renderApp(){
    ROOT.innerHTML = '';
    const html = `<div class="container"><div class="header"><div><h2>Stock Gudang</h2><div class="small">Mode: ${state.mode} • User: ${state.user || ''}</div></div><div><button id="logoutBtn">Logout</button></div></div>
    <div class="card" style="margin-bottom:12px;"><form id="addForm" style="display:flex;gap:8px;align-items:center"><input id="nama" placeholder="Nama barang"/><input id="stok" type="number" placeholder="Stok" style="width:120px"/><button type="submit">Tambah</button><button id="exportB" type="button">Export Barang CSV</button><button id="exportR" type="button">Export Riwayat CSV</button><button id="exportPdf" type="button">Export Riwayat PDF</button><button id="selftest" type="button" style="background:#f59e0b">Self-Test</button></form></div>
    <div style="display:flex;gap:12px"><div style="flex:2" class="card"><h3>Daftar Barang</h3><table class="table" id="tblBarang"><thead><tr><th>ID</th><th>Nama</th><th>Stok</th></tr></thead><tbody></tbody></table></div><div style="flex:1" class="card"><h3>Notifikasi</h3><div id="notifs"></div><h4 style="margin-top:12px">Transaksi</h4><form id="transForm" style="display:flex;flex-direction:column;gap:6px"><select id="selBarang"></select><input id="trJumlah" type="number" placeholder="Jumlah"/><select id="trTipe"><option value="masuk">Masuk</option><option value="keluar">Keluar</option></select><button type="submit">Proses</button></form><h4 style="margin-top:12px">Filter Riwayat</h4><input id="fStart" type="date"/><input id="fEnd" type="date"/><button id="resetFilter" type="button">Reset</button></div></div>
    <div class="card" style="margin-top:12px"><h3>Riwayat</h3><table class="table" id="tblRiwayat"><thead><tr><th>ID</th><th>Nama</th><th>Jumlah</th><th>Tipe</th><th>Waktu</th></tr></thead><tbody></tbody></table></div></div>`;
  ROOT.insertAdjacentHTML('beforeend', html);

  q('#logoutBtn').addEventListener('click', ()=>{ localStorage.removeItem(LS_KEYS.session); state.user=null; renderLogin(); });

  function refreshUI(){
    const tbody = q('#tblBarang tbody'); tbody.innerHTML=''; state.barang.forEach(b=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${b.id}</td><td>${b.nama}</td><td class="${Number(b.stok)<LOW_THRESHOLD?'low':''}">${b.stok}</td>`; tbody.appendChild(tr); });
    const sel = q('#selBarang'); sel.innerHTML='<option value="">-- pilih --</option>'; state.barang.forEach(b=>{ const o=document.createElement('option'); o.value=b.id; o.text=`${b.nama} (stok:${b.stok})`; sel.appendChild(o); });
    const notifs = q('#notifs'); const low = state.barang.filter(b=>Number(b.stok)<LOW_THRESHOLD); if(low.length===0) notifs.innerHTML='<div class="small">Semua aman</div>'; else notifs.innerHTML='<ul>'+low.map(b=>`<li class="low">${b.nama} (stok: ${b.stok})</li>`).join('')+'</ul>';
    const tbodyR = q('#tblRiwayat tbody'); const s=q('#fStart').value; const e=q('#fEnd').value; tbodyR.innerHTML=''; filteredRiwayat(s,e).forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.id}</td><td>${r.nama}</td><td>${r.jumlah}</td><td>${r.tipe}</td><td>${fmtDate(r.waktu)}</td>`; tbodyR.appendChild(tr); });
  }

  q('#addForm').addEventListener('submit', async (ev)=>{ ev.preventDefault(); const nama=q('#nama').value.trim(); const stok=Number(q('#stok').value)||0; if(!nama) return alert('Isi nama'); try{ await tryTambah(nama,stok); }catch(e){ alert('Gagal tambah'); } q('#nama').value=''; q('#stok').value=''; });

  q('#transForm').addEventListener('submit', async (ev)=>{ ev.preventDefault(); const id=q('#selBarang').value; const j=Number(q('#trJumlah').value)||0; const tipe=q('#trTipe').value; if(!id) return alert('Pilih barang'); if(j<=0) return alert('Jumlah > 0'); try{ await tryTransaksi(id,j,tipe); }catch(e){ alert('Gagal transaksi'); } q('#trJumlah').value=''; q('#selBarang').value=''; });

  q('#resetFilter').addEventListener('click', ()=>{ q('#fStart').value=''; q('#fEnd').value=''; refreshUI(); });

  q('#exportB').addEventListener('click', exportBarangCSV);
  q('#exportR').addEventListener('click', ()=>exportRiwayatCSV(q('#fStart').value,q('#fEnd').value));
  q('#exportPdf').addEventListener('click', ()=>exportRiwayatPDF(q('#fStart').value,q('#fEnd').value));
  q('#selftest').addEventListener('click', runSelfTest);

  refreshUI();
  }

  // init
  (async function(){
    try{ const s = JSON.parse(localStorage.getItem(LS_KEYS.session)||'null'); if(s && s.username) state.user = s.username; }catch(e){};
    await tryFetchData();
    if(!state.user) renderLogin(); else renderApp();
  })();

})();
