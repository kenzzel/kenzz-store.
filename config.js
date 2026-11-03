// Isi setelah membuat project Supabase.
// Aman diletakkan di frontend: hanya URL dan anon/publishable key.
// JANGAN pernah masukkan service_role key, password database, token Telegram,
// secret payment gateway, atau Gmail app password ke file ini.
window.KENZZ_CONFIG = {
  SUPABASE_URL: "ISI_SUPABASE_PROJECT_URL",
  SUPABASE_ANON_KEY: "ISI_SUPABASE_ANON_PUBLIC_KEY",
  // URL backend/Edge Function milikmu. Jangan simpan secret di sini.
  API_BASE_URL: "",
  // Endpoint backend OAuth TikTok milikmu (bukan client secret).
  TIKTOK_OAUTH_URL: "",
  // Link kontak toko. Ganti dengan akun resmi Kenzz Store.
  CONTACTS: {
    tiktok: "https://www.tiktok.com/",
    whatsapp: "https://wa.me/",
    telegram: "https://t.me/",
    instagram: "https://www.instagram.com/"
  }
};
