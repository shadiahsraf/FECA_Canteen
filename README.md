# Canteen POS — First Evangelical Church, Assiut

A fully static point-of-sale system for a church canteen. Pure **HTML + CSS + JavaScript** (no framework, no Node backend). Data lives in **Supabase (PostgreSQL)**; product images go to **Cloudinary**. Deploys to **Vercel** as a static site.

- `index.html` — password login (shared seller account)
- `seller.html` — POS: product grid, search, cart, checkout, printable receipt
- `admin.html` — dashboard: KPIs, charts, sales history, full product management

---

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`schema.sql`](./schema.sql), and **Run**. This creates the `products`, `sales`, and `sale_items` tables, enables Row Level Security, and adds a few sample products.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`

> The anon key is meant to be public — it is safe in frontend code and is protected by Row Level Security. Never put the **service_role** key in this project.

## 2. Cloudinary (images only)

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. Note your **Cloud name** (Dashboard).
3. **Settings → Upload → Upload presets → Add** an **unsigned** preset. Copy its name.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`

## 3. Passwords

Passwords are stored as **SHA-256 hashes**, never plaintext. To create a hash, open any page in the browser, open the console, and run:

```js
await hashText('your-new-password')
```

Copy the result into `js/config.js` (`SELLER_PASSWORD_HASH` / `ADMIN_PASSWORD_HASH`).

Defaults out of the box: seller password `seller`, admin password `admin` — **change both** before going live.

## 4. Configure

Open [`js/config.js`](./js/config.js) and fill in your Supabase URL + anon key, Cloudinary cloud name + preset, and the two password hashes. That's the only file you need to edit.

## 5. Run locally

Any static server works (opening the file directly will break module loading and Supabase). For example:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## Deploy to Vercel

Push this folder to a Git repo and import it in Vercel, or run `vercel` from the CLI. There is no framework to select — it deploys as static hosting.

### Option A — keys in `config.js` (simplest)
Just commit `js/config.js` with your values filled in. Done.

### Option B — Vercel environment variables
Keep secrets out of the repo. In **Vercel → Project → Settings → Environment Variables**, add any of:

```
SUPABASE_URL, SUPABASE_ANON_KEY,
CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_FOLDER,
SELLER_PASSWORD_HASH, ADMIN_PASSWORD_HASH
```

On each deploy, `build-env.js` (already wired in `vercel.json`) writes them into `js/env.js`, which `config.js` reads automatically. Variables you leave unset fall back to whatever is in `config.js`.

---

## Security notes (please read)

Because this is a no-backend static app, the shared seller password is checked **in the browser**, and all database traffic uses the public anon key. That means:

- Anyone with the deployed anon key can technically read/write the tables. Row Level Security is enabled but, without Supabase Auth, policies grant the `anon` role access. Keep the URL private and use it on trusted devices.
- The "admin password required to change price" rule is enforced in the UI by default. For **real** server-side enforcement, uncomment the **optional hardening** block at the bottom of `schema.sql`: it installs an `update_product_price` RPC (`SECURITY DEFINER`) that verifies the admin hash inside PostgreSQL. `js/supabase.js` already calls that RPC first and only falls back to a direct update if it isn't installed.

For a stronger setup later, add Supabase Auth and tighten the RLS policies to the authenticated role.

---

## Project structure

```
index.html          Login
seller.html         POS
admin.html          Admin dashboard
css/style.css       All styles
js/config.js        Your keys + passwords (edit this)
js/env.js           Build-time env (auto-generated; default no-op)
js/supabase.js      Supabase client + data access
js/cloudinary.js    Image uploads
js/app.js           Shared: auth, toasts, modals, formatting
js/seller.js        POS logic
js/admin.js         Dashboard logic
assets/emblem.svg   Church emblem
schema.sql          Database schema + RLS + optional hardening
build-env.js        Optional Vercel env injection
vercel.json         Static hosting config
```

## Data model

| products | sales | sale_items |
|---|---|---|
| id (uuid) | id (uuid) | id (uuid) |
| name | total_price | sale_id → sales |
| price | seller_name | product_id → products |
| category | created_at | quantity |
| image_url | | price_at_sale |
| quantity | | |
| code | | |
| created_at | | |
