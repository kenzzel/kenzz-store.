# Struktur Kenzz Store

## File wajib untuk website
- `index.html` — halaman utama toko.
- `admin.html` — halaman dashboard Admin.
- `owner.html` — halaman khusus Owner.
- `config.js` — konfigurasi publik Supabase, endpoint backend, dan tautan kontak.
- `assets/css/style.css` — seluruh gaya/tampilan.
- `assets/js/app.js` — fitur halaman utama, akun, keranjang, checkout, deposit, riwayat.
- `assets/js/admin.js` — logika dashboard Admin.
- `assets/js/owner.js` — logika panel Owner.

## File pendukung (tidak dimuat langsung oleh browser)
- `database/supabase_setup.sql` — jalankan sekali di Supabase SQL Editor untuk membuat struktur database, fungsi, trigger, dan kebijakan.
- `README.md` — petunjuk instalasi dan catatan teknis.

## File tidak terpakai
Tidak ada file asli yang dibuang. Semua 10 file proyek yang ada dipakai langsung atau dibutuhkan untuk setup/panduan. File hanya dipindahkan ke folder yang lebih teratur; referensi CSS dan JavaScript di HTML sudah disesuaikan.

## Deploy
Untuk hosting static seperti Vercel atau GitHub Pages, deploy isi folder ini sebagai satu proyek. Jangan hanya upload `index.html`; semua folder dan file di atas harus ikut.

## Keamanan
`config.js` hanya boleh berisi Supabase URL, anon/publishable key, URL endpoint publik, dan tautan kontak. Jangan masukkan `service_role`, password database, secret payment gateway, token bot, atau OAuth client secret ke frontend.
