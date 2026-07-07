-- =============================================================================
--  Canteen POS — Supabase / PostgreSQL schema
--  Run this in the Supabase dashboard → SQL Editor → New query → Run.
-- =============================================================================

create extension if not exists pgcrypto;   -- for gen_random_uuid() + digest()

-- ----------------------------------------------------------------------------
--  Tables
-- ----------------------------------------------------------------------------
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  price       numeric(10,2) not null default 0,
  category    text,
  image_url   text,
  quantity    integer not null default 0,
  code        text,
  created_at  timestamptz not null default now()
);

create table if not exists sales (
  id           uuid primary key default gen_random_uuid(),
  total_price  numeric(10,2) not null default 0,
  seller_name  text,
  created_at   timestamptz not null default now()
);

create table if not exists sale_items (
  id             uuid primary key default gen_random_uuid(),
  sale_id        uuid not null references sales(id) on delete cascade,
  product_id     uuid references products(id) on delete set null,
  quantity       integer not null default 1,
  price_at_sale  numeric(10,2) not null default 0
);

create index if not exists idx_sale_items_sale on sale_items(sale_id);
create index if not exists idx_sale_items_product on sale_items(product_id);
create index if not exists idx_sales_created on sales(created_at desc);
create index if not exists idx_products_category on products(category);

-- ----------------------------------------------------------------------------
--  Row Level Security
--
--  This app has no Supabase Auth — the shared seller password is checked in the
--  browser, so every request reaches Postgres as the `anon` role. The policies
--  below grant `anon` the access the app needs. This is the practical ceiling
--  for a purely static (no-backend) build: anyone holding the public anon key
--  can read/write these tables. Keep the key to trusted devices, and see the
--  optional hardening block below to move the admin price-check into the DB.
-- ----------------------------------------------------------------------------
alter table products   enable row level security;
alter table sales      enable row level security;
alter table sale_items enable row level security;

drop policy if exists p_products_all   on products;
drop policy if exists p_sales_all       on sales;
drop policy if exists p_sale_items_all  on sale_items;

create policy p_products_all   on products   for all to anon using (true) with check (true);
create policy p_sales_all      on sales      for all to anon using (true) with check (true);
create policy p_sale_items_all on sale_items for all to anon using (true) with check (true);

-- ----------------------------------------------------------------------------
--  Sample products (delete once you add your own)
-- ----------------------------------------------------------------------------
insert into products (name, price, category, quantity, code) values
  ('Karkadeh Tea',      10.00, 'Drinks',  40, 'DR01'),
  ('Turkish Coffee',    15.00, 'Drinks',  30, 'DR02'),
  ('Bottled Water',      5.00, 'Drinks', 120, 'DR03'),
  ('Cheese Sandwich',   20.00, 'Food',    25, 'FD01'),
  ('Feteer',            25.00, 'Food',    18, 'FD02'),
  ('Basbousa Slice',    12.00, 'Sweets',  35, 'SW01'),
  ('Chocolate Bar',      8.00, 'Sweets',  60, 'SW02'),
  ('Potato Chips',       7.00, 'Snacks',  80, 'SN01')
on conflict do nothing;


-- =============================================================================
--  OPTIONAL HARDENING — enforce the admin password inside the database
-- -----------------------------------------------------------------------------
--  With this installed, the frontend calls the `update_product_price` RPC
--  (supabase.js already tries it first) and price changes only succeed when the
--  correct admin password is supplied — checked server-side, not just in the UI.
--
--  To enable: uncomment everything below, set your own SHA-256 admin hash in the
--  app_secrets insert, then re-run this file.
-- =============================================================================

-- create table if not exists app_secrets (
--   id         int primary key default 1,
--   admin_hash text not null,
--   check (id = 1)
-- );
-- alter table app_secrets enable row level security;   -- no anon policy = unreadable
--
-- -- Default hash below is SHA-256 of "admin". Replace it.
-- insert into app_secrets (id, admin_hash)
--   values (1, '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918')
--   on conflict (id) do update set admin_hash = excluded.admin_hash;
--
-- create or replace function update_product_price(p_id uuid, p_price numeric, p_password text)
-- returns products
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   result products;
--   ok boolean;
-- begin
--   select (admin_hash = encode(digest(p_password, 'sha256'), 'hex'))
--     into ok from app_secrets where id = 1;
--   if not coalesce(ok, false) then
--     raise exception 'Invalid admin password';
--   end if;
--   update products set price = p_price where id = p_id returning * into result;
--   return result;
-- end;
-- $$;
--
-- revoke all on function update_product_price(uuid, numeric, text) from public;
-- grant execute on function update_product_price(uuid, numeric, text) to anon;
--
-- -- Optional: also block direct price UPDATEs by anon so the RPC is the only path.
-- -- (Requires a column-restricted policy; leave the permissive policy above off
-- --  and add fine-grained policies if you want to fully lock this down.)
