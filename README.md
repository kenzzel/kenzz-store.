# Kenzz Store — Rose Nebula

Prototype frontend responsif untuk Kenzz Store.

## Jalankan
Buka `index.html` di browser, atau unggah folder ini ke hosting statis untuk melihat prototipe.

## Fitur demo
- Landing page Rose Nebula
- Katalog dan pencarian produk
- Keranjang tersimpan di localStorage
- Profil, riwayat pesanan, dan simulasi deposit
- Demo tambah produk/admin

## Penting sebelum dipakai sungguhan
Ini masih frontend prototype. Login demo, deposit, checkout, dan pengiriman produk belum memproses transaksi nyata. Jangan menerima pembayaran berdasarkan status dari browser.

Integrasi produksi yang masih diperlukan:
1. Supabase Auth + database + RLS untuk akun, produk, saldo, keranjang, pesanan, dan riwayat.
2. OAuth Google dan GitHub melalui Supabase; TikTok memerlukan aplikasi OAuth resmi dan alur backend yang sesuai.
3. Payment gateway Indonesia (misalnya Tripay/Midtrans/Xendit), verifikasi webhook di server, idempotency, dan ledger saldo.
4. Telegram Bot API dipanggil dari backend/Edge Function; simpan token bot sebagai secret, bukan di HTML.
5. Pengiriman produk melalui Gmail/API resmi dari backend setelah pesanan tervalidasi.
6. Admin role divalidasi di database/server; jangan mengandalkan role localStorage.
7. Tautan kontak TikTok, WhatsApp, Telegram, Instagram dan kredensial admin perlu diisi pemilik toko.

## Branding
Nama dan watermark: KENZZ STORE. Tema: Rose Nebula.
