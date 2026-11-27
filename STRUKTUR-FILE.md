# Kenzz Store — fitur tambahan

File HTML, CSS, dan JS utama tetap di root agar referensi relatif yang sudah ada tidak rusak.
- `index.html`, `admin.html`, `owner.html`
- `style.css` — stylesheet sumber dengan tema Neo Brutalist yang sudah ada di bagian override bawah
- `app.js`, `admin.js`, `owner.js`
- `config.js`
- `supabase_setup.sql` dan `database/supabase_setup.sql`

Fitur baru: wishlist per akun, kontrol kuantitas keranjang, dan pengurutan katalog.
Jalankan migrasi tabel `favorites` pada Supabase sebelum memakai wishlist.
