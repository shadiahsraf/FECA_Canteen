# Canteen POS — First Evangelical Church, Assiut · كانتين الكنيسة الإنجيلية الأولى بأسيوط

A static, **Arabic-first (RTL)** point-of-sale system for a church canteen. Pure **HTML + CSS + JavaScript** (no framework, no Node backend). Data lives in **Supabase (PostgreSQL)**; product images go to **Cloudinary**. Deploys to **Vercel** as a static site.

- `index.html` — password login (shared seller account)
- `seller.html` — POS: product grid, search, cart, checkout, printable receipt
- `admin.html` — dashboard: KPIs, charts, sales history, refunds, daily closing, audit log, product management

## Feature highlights (v2)

| Area | What you get |
|---|---|
| 🌍 Language | Arabic-first RTL UI, one-tap English toggle (JSON dictionaries in `js/i18n.js`) |
| 🧾 Invoices | Sequential order numbers (`order_no`), timestamps, RTL-aware print layout |
| 🔐 Audit log | `logs` table records every product add/edit/delete, price change, sale, refund and daily close — **append-only** (no UPDATE/DELETE policy, ever) |
| 💰 Price protection | Price changes require the admin password, verified **inside PostgreSQL** (`update_product_price`), old → new price logged |
| 🗑️ Soft delete | Products are flagged `is_deleted`, never removed — history and reports stay intact |
| 📦 Stock safety | `quantity >= 0` CHECK constraint + atomic `process_sale` that locks rows, re-validates stock and uses **database prices** (client totals can't be tampered) |
| ↩️ Refunds | `refund_sale` restores stock, marks the sale `refunded` (never deletes it), logs the action; refunded sales are excluded from revenue |
| 📅 Daily closing | "Close Day" computes the Cairo-calendar-day totals server-side, admin enters actual cash, the difference is saved to `daily_reports` (one immutable report per day) |
| ⏱️ Sessions | Automatic sign-out after inactivity (`CONFIG.AUTO_LOGOUT_MINUTES`, default 15) |
| 📊 Dashboard | Chart.js daily revenue + orders, top products, sales history, daily reports, audit log |

---

## 1. Supabase (database)

### Fresh project
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`schema.sql`](./schema.sql), and **Run**. This creates `products`, `sales`, `sale_items`, `logs`, `daily_reports`, the security functions, and hardened Row Level Security.
3. Set your real admin password inside the database (used by the server-side checks):
   ```sql
   update app_secrets set admin_hash = '<sha256-of-your-admin-password>';
   ```
4. Go to **Project Settings → API** and copy **Project URL** → `SUPABASE_URL` and the **anon public** key → `SUPABASE_ANON_KEY`.

### Upgrading an existing (v1) database
1. Run [`migration.sql`](./migration.sql) (adds the new columns).
2. Then run [`schema.sql`](./schema.sql) — it is idempotent and will not duplicate data.
3. Set `app_secrets.admin_hash` as above.

> The anon key is meant to be public — it is protected by Row Level Security. Never put the **service_role** key in this project.

### What RLS enforces
- **Nothing** can be deleted through the API — there is no DELETE policy on any table.
- `logs` and `daily_reports` are append-only (INSERT + SELECT only).
- `sale_items` can never be rewritten after a sale.
- `sales` has no UPDATE policy — refunds only work through the `refund_sale` function, which demands the admin password.
- Checkout (`process_sale`), refunds, price changes and daily closing run as `SECURITY DEFINER` functions: validation + audit logging happen inside PostgreSQL, so a tampered browser cannot skip them.

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

Copy the result into `js/config.js` (`SELLER_PASSWORD_HASH` / `ADMIN_PASSWORD_HASH`) **and** into `app_secrets.admin_hash` in the database (step 1.3) so the browser and the database agree.

Defaults out of the box: seller password `seller`, admin password `admin` — **change both** before going live.

## 4. Configure

Open [`js/config.js`](./js/config.js): Supabase URL + anon key, Cloudinary cloud name + preset, the two password hashes, plus:

- `AUTO_LOGOUT_MINUTES` — inactivity window before automatic sign-out (default 15)
- `LOW_STOCK_THRESHOLD` — quantity at which products are flagged low (default 5)

## 5. Run locally

Any static server works (opening the file directly will break Supabase). For example:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## Language / اللغة

The UI is **Arabic by default**. The `English / عربي` button (top bar and login card) switches the language and direction instantly; the choice is remembered on the device. All strings live in the JSON dictionaries at the top of [`js/i18n.js`](./js/i18n.js) — edit or extend them there (e.g. add another language by adding a new top-level key).

## Daily closing workflow

1. End of day → **Admin → إغلاق اليوم (Close Day)**.
2. The dialog shows the expected cash (completed sales for today, Cairo time) and order count.
3. Count the drawer, enter the **actual cash** — the difference is computed live.
4. Confirm with the admin password. The report is saved to `daily_reports` and cannot be overwritten (one report per day) — closings are also audit-logged.

## Refunds

Admin → sales history → **استرجاع (Refund)** on any completed sale → optional reason → admin password. Stock is restored, the sale is marked `refunded` (kept forever), revenue KPIs exclude it, and the refund is logged.

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

Because this is a no-backend static app, the shared seller password is checked **in the browser**, and all database traffic uses the public anon key. The v2 hardening moves the important guarantees into PostgreSQL:

- Stock can never go negative (CHECK constraint + row locks in `process_sale`).
- Sale totals are computed from **database prices**, not whatever the browser sends.
- The admin password for price changes, refunds and daily closing is verified **in the database** (`app_secrets` is unreadable by the anon role).
- The audit log and daily reports are append-only at the RLS level.
- Nothing is hard-deleted, anywhere.

What remains inherent to a static build: anyone holding the anon key can still read the tables and insert products/sales. Keep the URL private, use trusted devices, and for a stronger setup later add Supabase Auth and tighten the RLS policies to the `authenticated` role.

---

## Project structure

```
index.html          Login (Arabic-first)
seller.html         POS
admin.html          Admin dashboard
css/style.css       All styles (RTL-aware logical properties)
js/config.js        Your keys + passwords + behaviour settings (edit this)
js/env.js           Build-time env (auto-generated; default no-op)
js/i18n.js          JSON translation dictionaries + language engine
js/supabase.js      Supabase client + data access + audit logging
js/cloudinary.js    Image uploads
js/app.js           Shared: auth, session timeout, toasts, modals, formatting
js/seller.js        POS logic
js/admin.js         Dashboard logic (refunds, daily close, audit log)
assets/emblem.svg   Church emblem
schema.sql          Database schema + RLS + security functions (idempotent)
migration.sql       v1 → v2 upgrade for an existing database
build-env.js        Optional Vercel env injection
vercel.json         Static hosting config
```

## Data model

| products | sales | sale_items | logs | daily_reports |
|---|---|---|---|---|
| id (uuid) | id (uuid) | id (uuid) | id | id |
| name | order_no (unique) | sale_id → sales | user_name | report_date (unique) |
| price | total_price | product_id → products | action | total_sales |
| category | seller_name | quantity | details (jsonb) | orders_count |
| image_url | status | price_at_sale | created_at | expected_cash |
| quantity | refunded_at / by / reason | | | actual_cash |
| code | created_at | | | difference |
| is_deleted | | | | closed_by, notes |
| created/updated_at | | | | created_at |
