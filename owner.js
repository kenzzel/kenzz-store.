(() => {
const C=window.KENZZ_CONFIG||{}, sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);let rows=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2500)}
function notice(s){$('notice').textContent=s}
async function boot(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){notice('Kamu belum login. Silakan login melalui halaman toko.');return}
 const {data:p,error}=await sb.from('profiles').select('id,full_name,email,role').eq('id',session.user.id).maybeSingle();
 if(error||!p){notice('Profil tidak ditemukan. Pastikan database sudah disiapkan.');return}
 if(p.role!=='owner'){notice('Akses ditolak. Hanya Owner yang dapat membuka halaman ini.');return}
 $('whoami').textContent=(p.full_name||p.email)+' · OWNER';$('ownerApp').classList.remove('hidden');notice('Akses Owner diberikan.');await refresh();
}
async function refresh(){
 const r=await sb.from('profiles').select('id,full_name,email,role,created_at').order('created_at',{ascending:false});
 if(r.error){notice('Gagal memuat anggota: '+r.error.message);return}rows=r.data||[];
 $('totalUsers').textContent=rows.length;$('adminCount').textContent=rows.filter(x=>x.role==='admin').length;$('ownerCount').textContent=rows.filter(x=>x.role==='owner').length;renderRows();
}
function renderRows(){
 const q=$('search').value.trim().toLowerCase();const list=rows.filter(x=>(x.full_name||'').toLowerCase().includes(q)||(x.email||'').toLowerCase().includes(q));
 $('users').innerHTML=list.map(x=>`<div class="ownerUserRow"><div class="ownerUserMeta"><b>${esc(x.full_name||'Tanpa nama')}</b><small>${esc(x.email||x.id)}</small><span class="ownerRole ${x.role==='owner'?'isOwner':x.role==='admin'?'isAdmin':''}">${esc((x.role||'user').toUpperCase())}</span></div><div class="ownerUserActions">${x.role==='owner'?'<small>Owner dilindungi</small>':`<select class="input ownerRoleSelect" data-new-role="${x.id}"><option value="user" ${x.role==='user'?'selected':''}>Member</option><option value="admin" ${x.role==='admin'?'selected':''}>Admin</option></select><button class="smallbtn" data-save-role="${x.id}">Simpan role</button>`}</div></div>`).join('')||'<div class="empty">Akun tidak ditemukan.</div>';
 document.querySelectorAll('[data-save-role]').forEach(b=>b.onclick=()=>setRole(b.dataset.saveRole));
}
async function setRole(id){
 const role=document.querySelector(`[data-new-role="${CSS.escape(id)}"]`)?.value;if(!role)return;
 const {error}=await sb.rpc('owner_set_member_role',{p_user_id:id,p_new_role:role});
 if(error){toast(error.message);return}toast('Role berhasil diperbarui');await refresh();
}
$('search').oninput=renderRows;$('refresh').onclick=refresh;$('logout').onclick=async()=>{await sb.auth.signOut();location.href='index.html'};boot();
})();