-- KENZZ STORE | Supabase SQL setup
-- Jalankan SELURUH script ini sekali di Supabase > SQL Editor.
-- Script memakai UUID, RLS, RPC checkout atomic, dan webhook deposit.
-- JANGAN menaruh service_role key / payment secret / Telegram token di frontend.

create extension if not exists pgcrypto;

-- 1. PROFILE & ROLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'user' check (role in ('user','admin','owner')),
  balance bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_kenzz on auth.users;
create trigger on_auth_user_created_kenzz
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

-- 2. HELPER ROLE (RLS)
create or replace function public.is_store_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','owner'));
$$;

-- 3. PRODUCTS
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price bigint not null check (price > 0),
  category text not null default 'digital' check (category in ('app','digital','other')),
  image_url text,
  stock integer not null default -1 check (stock >= -1),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
for each row execute procedure public.set_updated_at();

-- 4. CART
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

-- 5. ORDERS & ITEMS
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  delivery_email text not null,
  total_amount bigint not null check (total_amount >= 0),
  status text not null default 'paid_pending_fulfillment'
    check (status in ('pending_payment','paid_pending_fulfillment','processing','completed','cancelled','refunded')),
  payment_method text not null default 'wallet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
for each row execute procedure public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price bigint not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

-- 6. WALLET LEDGER (audit trail)
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount <> 0),
  transaction_type text not null check (transaction_type in ('deposit','purchase','refund','adjustment')),
  reference_id uuid,
  description text not null default '',
  created_at timestamptz not null default now()
);

-- 7. DEPOSITS
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount >= 1000),
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','cancelled')),
  provider text,
  provider_reference text unique,
  payment_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- 8. NOTIFICATION OUTBOX. Backend worker/Edge Function sends Telegram.
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- 9. STORE SETTINGS / SOCIAL CONTACTS (optional values filled by owner)
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 10. RPC CHECKOUT. Debits balance and creates order in ONE transaction.
create or replace function public.create_order_from_cart(p_delivery_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_total bigint;
  v_balance bigint;
begin
  if v_uid is null then raise exception 'Silakan login terlebih dahulu'; end if;
  if p_delivery_email is null or position('@' in p_delivery_email) < 2 then
    raise exception 'Email penerima tidak valid';
  end if;

  perform 1 from public.profiles where id = v_uid for update;
  select coalesce(sum(p.price * c.quantity),0)
    into v_total
  from public.cart_items c
  join public.products p on p.id=c.product_id
  where c.user_id=v_uid and p.is_active=true;

  if v_total <= 0 then raise exception 'Keranjang kosong atau produk tidak tersedia'; end if;

  select balance into v_balance from public.profiles where id=v_uid;
  if v_balance < v_total then raise exception 'Saldo tidak cukup. Silakan deposit dahulu'; end if;

  -- Check and decrement finite stock.
  if exists (
    select 1 from public.cart_items c join public.products p on p.id=c.product_id
    where c.user_id=v_uid and p.stock <> -1 and p.stock < c.quantity
  ) then raise exception 'Stok produk tidak mencukupi'; end if;

  update public.profiles set balance=balance-v_total where id=v_uid;

  insert into public.orders(user_id,delivery_email,total_amount,status,payment_method)
  values(v_uid,lower(trim(p_delivery_email)),v_total,'paid_pending_fulfillment','wallet')
  returning id into v_order_id;

  insert into public.order_items(order_id,product_id,product_name,unit_price,quantity)
  select v_order_id,p.id,p.name,p.price,c.quantity
  from public.cart_items c join public.products p on p.id=c.product_id
  where c.user_id=v_uid and p.is_active=true;

  update public.products p set stock=p.stock-c.quantity
  from public.cart_items c
  where c.user_id=v_uid and c.product_id=p.id and p.stock <> -1;

  insert into public.wallet_transactions(user_id,amount,transaction_type,reference_id,description)
  values(v_uid,-v_total,'purchase',v_order_id,'Pembelian Kenzz Store');

  delete from public.cart_items where user_id=v_uid;

  insert into public.notifications(user_id,event_type,title,message,payload)
  values(v_uid,'purchase_success','Pembelian berhasil','Pesanan berhasil dibuat dan menunggu pemrosesan.',
    jsonb_build_object('order_id',v_order_id,'total',v_total));

  insert into public.notifications(event_type,title,message,payload)
  values('admin_purchase','Pembelian baru','Ada pesanan baru di Kenzz Store.',
    jsonb_build_object('order_id',v_order_id,'user_id',v_uid,'total',v_total));

  return v_order_id;
end;
$$;

-- 11. PAYMENT WEBHOOK RPC. Hanya backend/service_role yang boleh memanggil.
create or replace function public.confirm_deposit_payment(
  p_deposit_id uuid,
  p_provider_reference text,
  p_provider text default 'payment_gateway'
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare d public.deposits%rowtype;
begin
  select * into d from public.deposits where id=p_deposit_id for update;
  if not found then raise exception 'Deposit tidak ditemukan'; end if;
  if d.status='paid' then return true; end if;
  if d.status <> 'pending' then raise exception 'Status deposit bukan pending'; end if;

  update public.deposits
    set status='paid', provider=p_provider,
        provider_reference=p_provider_reference, paid_at=now()
    where id=p_deposit_id;

  update public.profiles set balance=balance+d.amount where id=d.user_id;

  insert into public.wallet_transactions(user_id,amount,transaction_type,reference_id,description)
  values(d.user_id,d.amount,'deposit',d.id,'Deposit berhasil');

  insert into public.notifications(user_id,event_type,title,message,payload)
  values(d.user_id,'deposit_success','Deposit berhasil','Saldo berhasil ditambahkan.',
    jsonb_build_object('deposit_id',d.id,'amount',d.amount));

  insert into public.notifications(event_type,title,message,payload)
  values('admin_deposit','Deposit berhasil','Ada deposit baru yang berhasil dibayar.',
    jsonb_build_object('deposit_id',d.id,'user_id',d.user_id,'amount',d.amount));

  return true;
end;
$$;

-- Prevent users from calling payment confirmation themselves.
revoke all on function public.confirm_deposit_payment(uuid,text,text) from public, anon, authenticated;
grant execute on function public.confirm_deposit_payment(uuid,text,text) to service_role;
revoke all on function public.create_order_from_cart(text) from public, anon;
grant execute on function public.create_order_from_cart(text) to authenticated;

-- 12. TOP DEPOSIT VIEW (only completed deposits count)
create or replace view public.top_deposit_users as
select p.id as user_id, coalesce(nullif(p.full_name,''),'Member') as full_name,
       coalesce(sum(d.amount),0)::bigint as total_deposit
from public.profiles p
left join public.deposits d on d.user_id=p.id and d.status='paid'
group by p.id,p.full_name
having coalesce(sum(d.amount),0)>0
order by total_deposit desc;

-- 13. ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.deposits enable row level security;
alter table public.notifications enable row level security;
alter table public.store_settings enable row level security;

-- Profiles: own profile; admins can read all. Users cannot change role/balance.
drop policy if exists "profile read own or admin" on public.profiles;
create policy "profile read own or admin" on public.profiles for select to authenticated
using (id=auth.uid() or public.is_store_admin());
drop policy if exists "profile update own safe fields" on public.profiles;
create policy "profile update own safe fields" on public.profiles for update to authenticated
using (id=auth.uid() or public.is_store_admin())
with check (id=auth.uid() or public.is_store_admin());

-- A member may update their display name, but never self-promote or edit wallet balance.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() = old.id and not public.is_store_admin() then
    if new.role is distinct from old.role or new.balance is distinct from old.balance then
      raise exception 'Role dan saldo hanya dapat diubah oleh sistem/admin';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges before update on public.profiles
for each row execute procedure public.protect_profile_privileges();

-- Products: public reads active; admins manage.
drop policy if exists "public read active products" on public.products;
create policy "public read active products" on public.products for select
using (is_active=true or public.is_store_admin());
drop policy if exists "admin insert products" on public.products;
create policy "admin insert products" on public.products for insert to authenticated
with check (public.is_store_admin());
drop policy if exists "admin update products" on public.products;
create policy "admin update products" on public.products for update to authenticated
using (public.is_store_admin()) with check (public.is_store_admin());
drop policy if exists "admin delete products" on public.products;
create policy "admin delete products" on public.products for delete to authenticated
using (public.is_store_admin());

-- Cart belongs to the signed-in user.
drop policy if exists "cart own all" on public.cart_items;
create policy "cart own all" on public.cart_items for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Orders & items: user sees own; admins see/manage all. Order creation only via RPC.
drop policy if exists "orders own or admin read" on public.orders;
create policy "orders own or admin read" on public.orders for select to authenticated
using (user_id=auth.uid() or public.is_store_admin());
drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update" on public.orders for update to authenticated
using (public.is_store_admin()) with check (public.is_store_admin());
drop policy if exists "items own or admin read" on public.order_items;
create policy "items own or admin read" on public.order_items for select to authenticated
using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_store_admin())));

-- Wallet and deposits: own read; admin read. Users cannot write balance/ledger/deposit status.
drop policy if exists "wallet own or admin read" on public.wallet_transactions;
create policy "wallet own or admin read" on public.wallet_transactions for select to authenticated
using (user_id=auth.uid() or public.is_store_admin());
drop policy if exists "deposit own insert" on public.deposits;
create policy "deposit own insert" on public.deposits for insert to authenticated
with check (user_id=auth.uid() and status='pending');
drop policy if exists "deposit own or admin read" on public.deposits;
create policy "deposit own or admin read" on public.deposits for select to authenticated
using (user_id=auth.uid() or public.is_store_admin());

-- Notifications are private to user; admin can read all.
drop policy if exists "notifications own or admin read" on public.notifications;
create policy "notifications own or admin read" on public.notifications for select to authenticated
using (user_id=auth.uid() or public.is_store_admin());

drop policy if exists "settings public read" on public.store_settings;
create policy "settings public read" on public.store_settings for select
using (true);
drop policy if exists "settings admin manage" on public.store_settings;
create policy "settings admin manage" on public.store_settings for all to authenticated
using (public.is_store_admin()) with check (public.is_store_admin());

-- Restrict direct writes to sensitive tables; only SECURITY DEFINER RPCs/webhook.
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.wallet_transactions from anon, authenticated;
revoke update, delete on public.deposits from anon, authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;

-- 14. Bootstrap admin:
-- Setelah register akun pertama, ambil UUID dari Authentication > Users,
-- lalu jalankan manual query ini dengan UUID asli:
-- update public.profiles set role='owner' where id='PASTE-AUTH-USER-UUID-HERE';

-- Public leaderboard is read-only.
grant select on public.top_deposit_users to anon, authenticated;
