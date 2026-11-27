(() => {
const C=window.KENZZ_CONFIG||{}, sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id); let products=[];
const money=n=>'Rp'+Number(n||0).toLocaleString('id-ID');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message,type){const t=$('toast');if(!t)return;const m=String(message??'');const kind=type||(/\b(gagal|error|ditolak|tidak berhasil|invalid|failed|belum|wajib)\b/i.test(m)?'error':/\b(berhasil|disimpan|ditambahkan|dihapus|diperbarui|sukses|akses diberikan|masuk)\b/i.test(m)?'success':'info');t.textContent=m;t.className='toast show toast-'+kind;t.setAttribute('role',kind==='error'?'alert':'status');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3200)}
function notice(s){$('notice').textContent=s}
async function boot(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){notice('Kamu belum login. Silakan login melalui halaman toko.');return}
 const {data:p,error}=await sb.from('profiles').select('id,full_name,email,role').eq('id',session.user.id).maybeSingle();
 if(error||!p){notice('Profil tidak ditemukan. Pastikan setup database sudah dijalankan.');return}
 if(!['admin','owner'].includes(p.role)){notice('Akses ditolak. Halaman ini khusus Admin dan Owner.');return}
 $('whoami').textContent=(p.full_name||p.email)+' · '+p.role.toUpperCase();$('adminApp').classList.remove('hidden');notice('Akses diberikan.');
 await refresh();
}
async function refresh(){
 let [pr,or,de]=await Promise.all([
  sb.from('products').select('*').order('created_at',{ascending:false}),
  sb.from('orders').select('id,total_amount,status,created_at').order('created_at',{ascending:false}).limit(20),
  sb.from('deposits').select('id,amount,status,created_at').order('created_at',{ascending:false}).limit(20)
 ]);
 if(pr.error||or.error||de.error){notice('Gagal memuat data: '+(pr.error||or.error||de.error).message);return}
 products=pr.data||[];const orders=or.data||[], deposits=de.data||[];
 $('countProducts').textContent=products.filter(x=>x.is_active).length;$('countOrders').textContent=orders.length;$('countDeposits').textContent=deposits.filter(x=>x.status==='pending').length;
 $('products').innerHTML=products.map(p=>`<div class="adminRow"><span><b>${esc(p.name)}</b><br><small class="muted">${money(p.price)} · ${p.is_active?'Aktif':'Nonaktif'}</small></span><span><button class="textbtn" data-edit="${p.id}">Edit</button><button class="textbtn danger" data-delete="${p.id}">Hapus</button></span></div>`).join('')||'<div class="empty">Belum ada produk.</div>';
 $('orders').innerHTML=orders.map(o=>`<div class="adminRow"><span><b>#${o.id.slice(0,8)}</b><br><small class="muted">${esc(o.status)}</small></span><span><b>${money(o.total_amount)}</b><br><select class="input" data-status="${o.id}" style="margin:6px 0"><option value="paid_pending_fulfillment" ${o.status==='paid_pending_fulfillment'?'selected':''}>Menunggu proses</option><option value="processing" ${o.status==='processing'?'selected':''}>Diproses</option><option value="completed" ${o.status==='completed'?'selected':''}>Selesai</option><option value="cancelled" ${o.status==='cancelled'?'selected':''}>Dibatalkan</option></select><button class="smallbtn" data-save="${o.id}">Simpan</button></span></div>`).join('')||'<div class="empty">Belum ada pesanan.</div>';
 $('deposits').innerHTML=deposits.map(d=>`<div class="adminRow"><span>${money(d.amount)}<br><small class="muted">${esc(d.status)}</small></span><small>${new Date(d.created_at).toLocaleString('id-ID')}</small></div>`).join('')||'<div class="empty">Belum ada deposit.</div>';
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.edit));
 document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeProduct(b.dataset.delete));
 document.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>saveStatus(b.dataset.save));
}
function edit(id){const p=products.find(x=>x.id===id);if(!p)return;$('productId').value=p.id;$('name').value=p.name;$('price').value=p.price;$('category').value=p.category;$('description').value=p.description||'';$('image').value=p.image_url||'';$('stock').value=p.stock;$('active').checked=p.is_active;$('formTitle').textContent='Edit produk';window.scrollTo({top:0,behavior:'smooth'})}
function reset(){$('productForm').reset();$('productId').value='';$('stock').value=-1;$('active').checked=true;$('formTitle').textContent='Tambah produk'}
async function saveProduct(e){e.preventDefault();const id=$('productId').value;const data={name:$('name').value.trim(),price:Number($('price').value),category:$('category').value,description:$('description').value.trim(),image_url:$('image').value.trim()||null,stock:Number($('stock').value),is_active:$('active').checked};const r=id?await sb.from('products').update(data).eq('id',id):await sb.from('products').insert({...data,created_by:(await sb.auth.getUser()).data.user.id});if(r.error){toast(r.error.message);return}toast('Produk disimpan');reset();await refresh()}
async function removeProduct(id){if(!confirm('Hapus produk ini?'))return;const r=await sb.from('products').delete().eq('id',id);if(r.error){toast(r.error.message);return}toast('Produk dihapus');await refresh()}
async function saveStatus(id){const status=document.querySelector(`[data-status="${CSS.escape(id)}"]`).value;const r=await sb.from('orders').update({status}).eq('id',id);if(r.error){toast(r.error.message);return}toast('Status pesanan diperbarui');await refresh()}
$('productForm').onsubmit=saveProduct;$('reset').onclick=reset;$('refresh').onclick=refresh;$('logout').onclick=async()=>{await sb.auth.signOut();location.href='index.html'};boot();
})();