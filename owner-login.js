(() => {
  const C = window.KENZZ_CONFIG || {};
  const notice = document.getElementById('ownerLoginNotice');
  const form = document.getElementById('ownerLoginForm');
  const submit = document.getElementById('ownerLoginSubmit');
  function toast(message,type){const t=document.getElementById('toast');if(!t){notice.textContent=message;return}const m=String(message??'');const kind=type||(/gagal|error|ditolak|tidak berhasil|invalid|failed/i.test(m)?'error':/berhasil|sukses|akses diberikan|masuk/i.test(m)?'success':'info');t.textContent=m;t.className='toast show toast-'+kind;t.setAttribute('role',kind==='error'?'alert':'status');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3500);}
  const say = (message,type) => { notice.textContent = message; toast(message,type); };

  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
    say('Konfigurasi Supabase belum diisi. Periksa config.js terlebih dahulu.');
    submit.disabled = true;
    return;
  }
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  async function checkOwner(session) {
    if (!session) return false;
    const { data, error } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    if (error) { say('Gagal memeriksa role akun: ' + error.message); return false; }
    if (data?.role !== 'owner') {
      await sb.auth.signOut();
      say('Akses ditolak. Akun ini bukan Owner. Gunakan akun Owner yang terdaftar.');
      return false;
    }
    location.replace('owner.html');
    return true;
  }

  sb.auth.getSession().then(({ data }) => checkOwner(data.session));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Memeriksa akun...';
    const email = document.getElementById('ownerEmail').value.trim();
    const password = document.getElementById('ownerPassword').value;
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { say('Login gagal: ' + error.message,'error'); }
      else { say('Login berhasil. Memeriksa akses Owner...','success'); const allowed = await checkOwner(data.session); if (!allowed) submit.textContent = 'Coba lagi'; }
    } catch (error) { say('Login gagal: '+(error?.message||String(error)),'error'); submit.textContent='Coba lagi'; }
    finally { submit.disabled = false; }
  });
})();
