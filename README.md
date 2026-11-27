# KENZZ STORE — Neo Brutalist + WhatsApp Manual Order

## Fitur versi ini
- Login/register Supabase, profil, favorit, keranjang, dan riwayat lama.
- Owner Panel untuk mengelola akun serta produk (foto, nama, harga, kategori, deskripsi, stok, status).
- Tombol `Beli Sekarang` untuk checkout satu produk langsung.
- Tombol `+ Keranjang` tetap tersedia untuk belanja beberapa produk.
- Checkout meminta nama pembeli, nomor WhatsApp pembeli, dan email penerima produk digital.
- Konfirmasi checkout membuka WhatsApp Owner dengan detail produk, jumlah, harga, total, dan data pembeli yang sudah terisi.
- Owner mengirim instruksi pembayaran manual (QRIS, DANA, GoPay, atau transfer bank), memeriksa bukti pembayaran, dan mengurus pesanan secara manual.
- Tidak menggunakan deposit, saldo wallet, Midtrans, atau backend pembayaran otomatis.

## Nomor WhatsApp Owner
Sudah diatur pada `OWNER_WHATSAPP` di `config.js` dalam format internasional tanpa tanda `+`. Untuk mengganti nomor, ubah nilai tersebut.

## Instalasi
1. Upload/deploy seluruh isi folder ini ke hosting static website (misalnya Vercel).
2. Pastikan `config.js` berisi Supabase URL dan anon/publishable key yang benar.
3. Jalankan `supabase_setup.sql` jika database belum disiapkan. Jika database lama sudah berjalan, jangan menjalankan ulang seluruh SQL tanpa memeriksa migrasi terlebih dahulu; fitur WhatsApp manual ini tidak memerlukan SQL tambahan.
4. Atur Site URL dan Redirect URLs pada Supabase Authentication sesuai domain website.
5. Akun Owner harus sudah memiliki `role='owner'` di tabel `profiles`.

## Catatan penting
- Pesanan yang dikirim lewat WhatsApp pada versi ini belum otomatis disimpan sebagai transaksi baru di tabel `orders` dan belum muncul otomatis di Riwayat Pembelian. Owner mengelola konfirmasi dan status secara manual melalui WhatsApp.
- Tombol WhatsApp hanya menyiapkan pesan dan membuka percakapan; website tidak dapat memverifikasi pembayaran atau bukti transfer.
- Jangan meminta atau membagikan password akun pribadi pembeli.
- `server-example.js` dan SQL Midtrans lama masih disertakan sebagai arsip dari versi sebelumnya, tetapi tidak dipakai oleh checkout manual ini.
