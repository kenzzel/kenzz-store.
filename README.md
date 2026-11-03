# KENZZ STORE — Rose Nebula (Supabase-ready)

## Isi paket
- `index.html` — semua halaman dan elemen UI.
- `style.css` — desain Rose Nebula responsif.
- `app.js` — aksi tombol, navigasi, autentikasi, produk, keranjang, checkout, deposit, profil, riwayat, leaderboard, admin.
- `config.js` — tempat memasang URL + anon key Supabase dan URL backend.
- `supabase_setup.sql` — satu script SQL lengkap untuk Supabase.

## Langkah pemasangan
1. Buat project Supabase.
2. Buka SQL Editor, tempel seluruh `supabase_setup.sql`, lalu Run.
3. Buka `config.js`, isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY`.
4. Deploy folder ini ke Vercel sebagai static site.
5. Di Supabase Authentication, atur Site URL dan Redirect URLs ke domain Vercel.
6. Aktifkan provider Google/GitHub di Supabase dan masukkan credential provider di dashboard Supabase.
7. Register akun pertama lewat website. Di Supabase > Authentication > Users, salin UUID akun itu. Kembali ke SQL Editor dan jalankan:
   `update public.profiles set role='owner' where id='UUID-AKUN-OWNER';`
8. Isi tautan sosial di `config.js`.

## Status tombol
Navigasi, pencarian/kategori, tambah/hapus keranjang, checkout, login/register email, Google/GitHub OAuth, TikTok OAuth redirect, profil, logout, deposit request, riwayat, leaderboard, kontak, tambah/edit/hapus produk, refresh admin sudah memiliki handler.
- Dalam mode preview tanpa Supabase, tombol tetap merespons dan memberi pesan bahwa backend belum dikonfigurasi. Data transaksi sungguhan tidak dibuat.
- Untuk operasi akun/produk/transaksi nyata, isi konfigurasi dan jalankan SQL.
- Checkout menggunakan RPC SQL `create_order_from_cart` yang memotong saldo secara atomik.
- Deposit baru menjadi saldo setelah backend memverifikasi webhook dan memanggil `confirm_deposit_payment`.

## API / secret placement
`config.js` hanya untuk nilai publik:
- Supabase project URL
- Supabase anon/publishable key
- URL backend/Edge Function
- URL OAuth TikTok backend
- link sosial

JANGAN masukkan ke `config.js` atau file frontend:
- Supabase `service_role` key
- password database
- payment gateway secret/API secret
- Telegram bot token
- Gmail app password / OAuth client secret

Simpan rahasia tersebut sebagai Supabase Edge Function Secrets / Vercel Environment Variables. Endpoint backend yang perlu dibuat:
- `POST /create-payment`: terima deposit_id, validasi user/session, buat invoice ke payment gateway, simpan provider_reference/payment_url.
- `POST /payment-webhook`: verifikasi signature provider, cocokkan nominal & deposit_id, lalu panggil `confirm_deposit_payment` dengan service role.
- `POST /telegram-notify` atau worker: baca `notifications` yang belum terkirim, kirim Telegram, lalu isi sent_at.
- `POST /tiktok-oauth/*`: alur OAuth TikTok resmi, validasi state dan callback.

## Catatan keamanan dan batasan
- Jangan pernah menandai pembayaran berhasil dari browser. Hanya webhook backend terverifikasi.
- RLS mencegah user mengubah saldo dan status deposit sendiri.
- Akun owner harus dipromosikan manual via SQL setelah register.
- TikTok OAuth tidak tersedia sebagai provider standar Supabase Auth seperti Google/GitHub; perlu backend OAuth resmi.
- Pengiriman produk Gmail belum otomatis dikirim dari frontend. Backend perlu fulfillment worker yang mengirim instruksi/produk yang sah setelah order paid.
- Untuk Alight Motion, jangan mengirim password akun pribadi atau menjual akses yang melanggar ketentuan penyedia. Gunakan metode distribusi resmi.
- Admin dapat melihat pesanan dan mengubah status pemrosesan. Deposit hanya dinyatakan paid oleh webhook backend, bukan tombol admin/browser.
