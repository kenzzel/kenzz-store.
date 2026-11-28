(() => {
const C=window.KENZZ_CONFIG||{}, sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);let rows=[],products=[],editingProductId=null,selectedImage=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message,type){const t=$('toast');if(!t)return;const m=String(message??'');const kind=type||(/\b(gagal|error|ditolak|tidak berhasil|invalid|failed|belum|wajib)\b/i.test(m)?'error':/\b(berhasil|disimpan|ditambahkan|dihapus|diperbarui|sukses|akses diberikan|masuk)\b/i.test(m)?'success':'info');t.textContent=m;t.className='toast show toast-'+kind;t.setAttribute('role',kind==='error'?'alert':'status');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3200)}
function notice(s){$('notice').style.whiteSpace='pre-wrap';$('notice').textContent=s}
async function boot(){
 const {data:{session}}=await sb.auth.getSession();
 if(!session){notice('Kamu belum login. Silakan login melalui halaman toko.');return}
 const {data:p,error}=await sb.from('profiles').select('id,full_name,email,role').eq('id',session.user.id).maybeSingle();
 if(error||!p){notice('Profil tidak ditemukan. Pastikan database sudah disiapkan.');return}
 if(p.role!=='owner'){notice('Akses ditolak. Hanya Owner yang dapat membuka halaman ini.');return}
 $('whoami').textContent=(p.full_name||p.email)+' · OWNER';$('ownerApp').classList.remove('hidden');notice('Akses Owner diberikan.');await refresh();await loadProducts();
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
async function loadProducts(){
 const {data,error}=await sb.from('products').select('*').order('created_at',{ascending:false});
 if(error){$('productList').innerHTML='<div class="empty">Gagal memuat produk: '+esc(error.message)+'</div>';return}
 products=data||[];renderProducts();
}
function renderProducts(){
 const q=$('productSearch').value.trim().toLowerCase();const list=products.filter(p=>(p.name||'').toLowerCase().includes(q));
 $('productList').innerHTML=list.map(p=>`<div class="ownerUserRow"><div style="display:flex;align-items:center;gap:12px;min-width:0">${p.image_url?`<img src="${esc(p.image_url)}" alt="" style="width:64px;height:64px;object-fit:cover;border:2px solid #171717;background:white">`:'<div style="width:64px;height:64px;border:2px solid #171717;display:grid;place-items:center">No image</div>'}<div class="ownerUserMeta"><b>${esc(p.name)}</b><small>Rp ${Number(p.price||0).toLocaleString('id-ID')} · ${esc(p.category||'digital')}</small><small>Stok: ${Number(p.stock)===-1?'Tidak terbatas':esc(p.stock)}</small><span class="ownerRole ${p.is_active?'isAdmin':''}">${p.release_status==='upcoming'?'MENDATANG':(p.is_active?'AKTIF':'NONAKTIF')}</span></div></div><div class="ownerUserActions"><button class="smallbtn" data-edit-product="${p.id}">Edit</button><button class="smallbtn" data-delete-product="${p.id}" style="background:#ffb4b4">Hapus</button></div></div>`).join('')||'<div class="empty">Belum ada produk.</div>';
 document.querySelectorAll('[data-edit-product]').forEach(b=>b.onclick=()=>editProduct(b.dataset.editProduct));
 document.querySelectorAll('[data-delete-product]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.deleteProduct));
}
function resetProductForm(){editingProductId=null;selectedImage=null;$('productForm').reset();$('productStock').value='-1';$('productActive').value='true';$('productRelease').value='released';$('imagePreview').innerHTML='<span class="muted">Preview foto produk</span>';$('saveProduct').textContent='Simpan produk';}
function editProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;editingProductId=id;selectedImage=null;
 $('productName').value=p.name||'';$('productPrice').value=p.price||'';$('productCategory').value=p.category||'digital';$('productDescription').value=p.description||'';$('productStock').value=p.stock??-1;$('productActive').value=String(!!p.is_active);$('productRelease').value=p.release_status||'released';$('productImage').value='';
 $('imagePreview').innerHTML=p.image_url?`<img src="${esc(p.image_url)}" alt="Preview" style="max-width:100%;max-height:190px;object-fit:contain">`:'<span class="muted">Belum ada foto</span>';$('saveProduct').textContent='Update produk';$('productManager').scrollIntoView({behavior:'smooth'});
}
async function saveProduct(e){
 e.preventDefault();const name=$('productName').value.trim(),price=Number($('productPrice').value),stock=Number($('productStock').value);
 if(!name||!Number.isSafeInteger(price)||price<1||!Number.isInteger(stock)||stock< -1){toast('Periksa nama, harga, dan stok produk.');return}
 $('saveProduct').disabled=true;$('saveProduct').textContent='Menyimpan...';
 try{
  let imageUrl=editingProductId?(products.find(x=>x.id===editingProductId)?.image_url||null):null;
  if(selectedImage){
   const {data:authData,error:authError}=await sb.auth.getSession();
   if(authError)throw new Error('Pemeriksaan sesi gagal: '+authError.message);
   const session=authData?.session;
   if(!session?.access_token)throw new Error('Sesi Supabase tidak memiliki access token. Keluar lalu login ulang.');
   const ext=(selectedImage.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
   const randomName=(globalThis.crypto?.randomUUID?.()||(`${Date.now()}-${Math.random().toString(16).slice(2)}`));
   const path=`${randomName}.${ext}`;
   notice('DIAGNOSTIK UPLOAD\nSesi: tersedia · User: '+session.user.id+'\nFile: '+selectedImage.name+' ('+selectedImage.size+' byte) · MIME: '+(selectedImage.type||'(kosong)')+'\nTujuan: '+C.SUPABASE_URL+'/storage/v1/object/kenzz-products/'+path+'\nMengirim permintaan...');
   let up;
   try{
    up=await sb.storage.from('kenzz-products').upload(path,selectedImage,{upsert:false,contentType:selectedImage.type||'image/jpeg'});
   }catch(networkError){
    console.error('[KENZZ UPLOAD NETWORK ERROR]',networkError);
    const details={name:networkError?.name||'Error',message:networkError?.message||String(networkError),status:networkError?.status,statusCode:networkError?.statusCode,code:networkError?.code,cause:networkError?.cause?String(networkError.cause):null,online:navigator.onLine,secureContext:isSecureContext};
    notice('UPLOAD GAGAL — ERROR JARINGAN\n'+JSON.stringify(details,null,2)+'\n\nCatatan: tidak ada token/password yang ditampilkan.');
    throw new Error('Upload gagal pada lapisan jaringan. Buka kotak diagnostik untuk detail.');
   }
   if(up.error){
    const storageError=up.error;
    console.error('[KENZZ STORAGE ERROR]',storageError);
    const details={name:storageError.name||'StorageError',message:storageError.message||String(storageError),status:storageError.status,statusCode:storageError.statusCode,error:storageError.error,code:storageError.code,online:navigator.onLine,secureContext:isSecureContext};
    notice('UPLOAD DITOLAK / GAGAL OLEH SUPABASE STORAGE\n'+JSON.stringify(details,null,2));
    throw new Error('Supabase Storage: '+(storageError.message||'upload gagal')+(storageError.statusCode?' (HTTP '+storageError.statusCode+')':''));
   }
   imageUrl=sb.storage.from('kenzz-products').getPublicUrl(path).data.publicUrl;
   notice('Upload foto berhasil. Menyimpan data produk...');
  }
  const payload={name,price,category:$('productCategory').value,description:$('productDescription').value.trim(),stock,is_active:$('productActive').value==='true',release_status:$('productRelease').value,image_url:imageUrl};
  let result;if(editingProductId)result=await sb.from('products').update(payload).eq('id',editingProductId);else{const {data:{user}}=await sb.auth.getUser();result=await sb.from('products').insert({...payload,created_by:user.id});}
  if(result.error)throw result.error;toast(editingProductId?'Produk berhasil diperbarui.':'Produk berhasil ditambahkan.');resetProductForm();await loadProducts();
 }catch(err){console.error('[KENZZ SAVE PRODUCT ERROR]',err);toast('Gagal menyimpan: '+(err.message||'Kesalahan tidak diketahui'));if(!String($('notice').textContent||'').includes('UPLOAD GAGAL')&&!String($('notice').textContent||'').includes('UPLOAD DITOLAK'))notice('GAGAL MENYIMPAN PRODUK\nNama error: '+(err?.name||'Error')+'\nPesan: '+(err?.message||String(err))+'\nOnline: '+navigator.onLine+' · HTTPS: '+isSecureContext);}
 finally{$('saveProduct').disabled=false;$('saveProduct').textContent=editingProductId?'Update produk':'Simpan produk';}
}
async function deleteProduct(id){if(!confirm('Yakin ingin menghapus produk ini?'))return;const {error}=await sb.from('products').delete().eq('id',id);if(error){toast('Gagal menghapus: '+error.message);return}toast('Produk dihapus.');await loadProducts();}
$('productImage').onchange=e=>{selectedImage=e.target.files?.[0]||null;if(!selectedImage)return;if(!selectedImage.type.startsWith('image/')){toast('File harus berupa gambar.');selectedImage=null;e.target.value='';return}if(selectedImage.size>5*1024*1024){toast('Ukuran foto maksimal 5 MB.');selectedImage=null;e.target.value='';return}const url=URL.createObjectURL(selectedImage);$('imagePreview').innerHTML=`<img src="${url}" alt="Preview" style="max-width:100%;max-height:190px;object-fit:contain">`;};
$('productForm').onsubmit=saveProduct;$('resetProduct').onclick=resetProductForm;$('cancelEdit').onclick=resetProductForm;$('productSearch').oninput=renderProducts;
$('search').oninput=renderRows;$('refresh').onclick=async()=>{await refresh();await loadProducts()};$('logout').onclick=async()=>{await sb.auth.signOut();location.href='index.html'};boot();
})();