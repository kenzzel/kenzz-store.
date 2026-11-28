-- KENZZ STORE: atomic manual WhatsApp checkout with stock deduction.
-- Run this patch once in Supabase SQL Editor.
-- Stock is deducted only when the buyer confirms/sends the order,
-- not merely when opening the product detail/checkout dialog.

create or replace function public.create_manual_order(
  p_items jsonb,
  p_delivery_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_item record;
  v_product public.products%rowtype;
  v_total bigint := 0;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Silakan login sebelum membuat pesanan';
  end if;
  if p_delivery_email is null or trim(p_delivery_email) = '' or position('@' in p_delivery_email) = 0 then
    raise exception 'Email penerima tidak valid';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Daftar produk pesanan kosong';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by x.product_id
    having count(*) > 1
  ) then
    raise exception 'Produk yang sama tidak boleh muncul dua kali dalam pesanan';
  end if;

  -- Lock each product row in a stable order to prevent overselling
  -- when two buyers check out at nearly the same time.
  for v_item in
    select x.product_id, x.quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    order by x.product_id
  loop
    v_count := v_count + 1;
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 99 then
      raise exception 'Jumlah produk tidak valid';
    end if;
    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;
    if not found or v_product.is_active is not true then
      raise exception 'Produk tidak tersedia lagi';
    end if;
    if v_product.stock <> -1 and v_product.stock < v_item.quantity then
      raise exception 'Stok produk % tidak mencukupi. Sisa stok: %', v_product.name, v_product.stock;
    end if;
    v_total := v_total + (v_product.price * v_item.quantity);
  end loop;

  if v_count <> jsonb_array_length(p_items) then
    raise exception 'Ada item pesanan yang tidak valid';
  end if;

  insert into public.orders(user_id, delivery_email, total_amount, status, payment_method)
  values(v_uid, lower(trim(p_delivery_email)), v_total, 'pending_payment', 'whatsapp_manual')
  returning id into v_order_id;

  for v_item in
    select x.product_id, x.quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    order by x.product_id
  loop
    select * into v_product from public.products where id = v_item.product_id;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity)
    values(v_order_id, v_product.id, v_product.name, v_product.price, v_item.quantity);

    if v_product.stock <> -1 then
      update public.products
      set stock = stock - v_item.quantity
      where id = v_item.product_id;
    end if;

    delete from public.cart_items
    where user_id = v_uid and product_id = v_item.product_id;
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_manual_order(jsonb, text) from public, anon;
grant execute on function public.create_manual_order(jsonb, text) to authenticated;
