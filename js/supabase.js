/* =============================================================================
 *  supabase.js  —  Database access layer.
 *  Requires the Supabase JS client (loaded via CDN in each HTML page),
 *  config.js and i18n.js to be loaded first.
 *
 *  Financial actions (checkout, refund, price change, daily close) call the
 *  SECURITY DEFINER functions from schema.sql first, so validation + audit
 *  logging happen INSIDE PostgreSQL. If the database has not been upgraded
 *  yet, each call falls back to a validated client-side path so nothing
 *  breaks — but run migration.sql + schema.sql for real protection.
 * ========================================================================== */

const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* True when an error means "this RPC / column does not exist yet" (v1 DB). */
function dbMissing(error) {
  if (!error) return false;
  return error.code === '42883' || error.code === '42703' || error.code === 'PGRST202'
    || /does not exist|could not find the/i.test(error.message || '');
}

/* Translate raised DB exceptions (see schema.sql) into human messages. */
function friendlyDbError(err) {
  const msg = err?.message || '';
  if (/INSUFFICIENT_STOCK/.test(msg)) {
    const m = msg.match(/INSUFFICIENT_STOCK:([^:]*):(\d+)/);
    return t('err_insufficient_stock', { name: m?.[1] ?? '', n: m?.[2] ?? 0 });
  }
  if (/PRODUCT_NOT_FOUND/.test(msg))       return t('err_product_not_found');
  if (/EMPTY_CART/.test(msg))              return t('err_empty_cart');
  if (/INVALID_ADMIN_PASSWORD/.test(msg))  return t('err_invalid_admin');
  if (/ALREADY_REFUNDED/.test(msg))        return t('already_refunded');
  if (/DAY_ALREADY_CLOSED/.test(msg))      return t('day_already_closed');
  if (/BAD_CASH_AMOUNT/.test(msg))         return t('invalid_cash');
  if (/BAD_PRICE/.test(msg))               return t('invalid_price');
  if (/BAD_QUANTITY/.test(msg))            return t('invalid_qty');
  return msg || t('err_generic');
}

/* ----------------------------------------------------------------------------
 *  Audit logs — append-only. Never throws: an audit failure must not block
 *  the till, but it is loudly reported in the console.
 * -------------------------------------------------------------------------- */
const Logs = {
  async record(userName, action, details = {}) {
    try {
      const { error } = await db.from('logs')
        .insert({ user_name: userName, action, details });
      if (error) throw error;
    } catch (err) {
      console.warn('[audit] failed to write log:', action, err?.message);
    }
  },

  async list(limit = 100) {
    const { data, error } = await db.from('logs')
      .select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  },
};

/* Who is acting right now — for audit attribution with a shared login. */
function currentActor() {
  return Auth?.isAdminVerified?.() ? 'admin' : (CONFIG.SELLER_NAME || 'seller');
}

/* ----------------------------------------------------------------------------
 *  Input validation helpers
 * -------------------------------------------------------------------------- */
const Validate = {
  productName(v)  { const s = String(v ?? '').trim(); return s.length >= 1 && s.length <= 120 ? s : null; },
  price(v)        { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : null; },
  quantity(v)     { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 100000 ? n : null; },
  cash(v)         { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 10000000 ? Math.round(n * 100) / 100 : null; },
  text(v, max = 300) { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; },
};

/* ----------------------------------------------------------------------------
 *  Products
 * -------------------------------------------------------------------------- */
const Products = {
  async list() {
    // Hide soft-deleted products; fall back for v1 databases without the column.
    let q = await db.from('products').select('*')
      .eq('is_deleted', false)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (q.error && dbMissing(q.error)) {
      q = await db.from('products').select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
    }
    if (q.error) throw q.error;
    return q.data || [];
  },

  async create(product) {
    const clean = this._sanitize(product, { withPrice: true });
    const { data, error } = await db.from('products').insert(clean).select().single();
    if (error) throw error;
    Logs.record(currentActor(), 'product_add',
      { product_id: data.id, name: data.name, price: data.price, quantity: data.quantity });
    return data;
  },

  /* Updates everything EXCEPT price. Price has its own admin-gated path. */
  async update(id, fields, previous = null) {
    const clean = this._sanitize(fields, { withPrice: false });
    const { data, error } = await db.from('products').update(clean).eq('id', id).select().single();
    if (error) throw error;
    Logs.record(currentActor(), 'product_update', {
      product_id: id, name: data.name,
      changes: previous ? diffFields(previous, clean) : clean,
    });
    return data;
  },

  /* Admin-gated price change — verified AND logged inside the database when
   * the v2 update_product_price RPC is installed. */
  async updatePrice(id, newPrice, adminPasswordPlain, oldPrice = null) {
    const price = Validate.price(newPrice);
    if (price === null) throw new Error(t('invalid_price'));

    const rpc = await db.rpc('update_product_price', {
      p_id: id, p_price: price, p_password: adminPasswordPlain, p_user: 'admin',
    });
    if (!rpc.error) return rpc.data;

    if (!dbMissing(rpc.error)) throw new Error(friendlyDbError(rpc.error));

    // v1 fallback — admin already verified in the UI; log client-side.
    const { data, error } = await db
      .from('products').update({ price }).eq('id', id).select().single();
    if (error) throw error;
    Logs.record('admin', 'price_change',
      { product_id: id, name: data.name, old_price: oldPrice, new_price: price });
    return data;
  },

  /* SOFT delete only — the row is flagged, never removed, so history and
   * financial reports stay intact. */
  async remove(id, name = '') {
    const { error } = await db.from('products')
      .update({ is_deleted: true }).eq('id', id);
    if (error) {
      if (dbMissing(error)) throw new Error(t('migration_needed'));
      throw error;
    }
    Logs.record('admin', 'product_delete', { product_id: id, name });
  },

  /* Clamped read-modify-write, used only by the v1 checkout fallback. */
  async adjustQuantity(id, delta) {
    const { data: row, error: readErr } = await db
      .from('products').select('quantity').eq('id', id).single();
    if (readErr) throw readErr;
    const next = Math.max(0, (row.quantity || 0) + delta);   // never negative
    const { error } = await db.from('products').update({ quantity: next }).eq('id', id);
    if (error) throw error;
    return next;
  },

  _sanitize(fields, { withPrice }) {
    const out = {};
    if ('name' in fields) {
      const name = Validate.productName(fields.name);
      if (name === null) throw new Error(t('name_required'));
      out.name = name;
    }
    if ('category' in fields)  out.category  = Validate.text(fields.category, 60);
    if ('code' in fields)      out.code      = Validate.text(fields.code, 40);
    if ('image_url' in fields) out.image_url = Validate.text(fields.image_url, 500);
    if ('quantity' in fields) {
      const qty = Validate.quantity(fields.quantity);
      if (qty === null) throw new Error(t('invalid_qty'));
      out.quantity = qty;
    }
    if (withPrice && 'price' in fields) {
      const price = Validate.price(fields.price);
      if (price === null) throw new Error(t('invalid_price'));
      out.price = price;
    }
    return out;
  },
};

function diffFields(prev, next) {
  const changes = {};
  for (const k of Object.keys(next)) {
    const a = prev?.[k] ?? null, b = next[k] ?? null;
    if (String(a) !== String(b)) changes[k] = { from: a, to: b };
  }
  return changes;
}

/* ----------------------------------------------------------------------------
 *  Sales — checkout, history, refunds
 * -------------------------------------------------------------------------- */
const Sales = {
  /* cart: [{ id, name, price, quantity }] → atomic server-side checkout.
   * Stock is re-validated and prices are taken from the DATABASE, so client
   * tampering or stale prices cannot corrupt totals. */
  async checkout(cart, sellerName) {
    if (!cart.length) throw new Error(t('err_empty_cart'));
    for (const i of cart) {
      if (Validate.quantity(i.quantity) === null || i.quantity <= 0) {
        throw new Error(t('invalid_qty'));
      }
    }

    const items = cart.map(i => ({ id: i.id, quantity: i.quantity }));
    const rpc = await db.rpc('process_sale', { p_items: items, p_seller: sellerName });
    if (!rpc.error) return { ...rpc.data, items: cart };

    if (!dbMissing(rpc.error)) throw new Error(friendlyDbError(rpc.error));

    return this._legacyCheckout(cart, sellerName);
  },

  /* v1 fallback: validates stock against fresh data first, still refuses
   * insufficient stock, and audit-logs client-side. Not atomic — upgrade the
   * database for full protection. */
  async _legacyCheckout(cart, sellerName) {
    const { data: fresh, error: freshErr } = await db
      .from('products').select('id, name, price, quantity')
      .in('id', cart.map(i => i.id));
    if (freshErr) throw freshErr;
    const byId = new Map((fresh || []).map(p => [p.id, p]));

    let total = 0;
    for (const i of cart) {
      const p = byId.get(i.id);
      if (!p) throw new Error(t('err_product_not_found'));
      if ((p.quantity ?? 0) < i.quantity) {
        throw new Error(t('err_insufficient_stock', { name: p.name, n: p.quantity ?? 0 }));
      }
      total += Number(p.price) * i.quantity;   // DB price, not cart price
    }
    total = Math.round(total * 100) / 100;

    const { data: sale, error: saleErr } = await db
      .from('sales').insert({ total_price: total, seller_name: sellerName }).select().single();
    if (saleErr) throw saleErr;

    const rows = cart.map(i => ({
      sale_id: sale.id, product_id: i.id, quantity: i.quantity,
      price_at_sale: Number(byId.get(i.id).price),
    }));
    const { error: itemsErr } = await db.from('sale_items').insert(rows);
    if (itemsErr) throw itemsErr;

    for (const i of cart) {
      try { await Products.adjustQuantity(i.id, -i.quantity); } catch (_) { /* stock race */ }
    }

    Logs.record(sellerName || 'seller', 'sale', {
      sale_id: sale.id, order_no: sale.order_no ?? null, total,
      items: cart.map(i => ({ product: i.name, qty: i.quantity })),
    });
    return { ...sale, items: cart, total_price: total };
  },

  /* Admin-verified refund: restores stock, marks the sale refunded, logs. */
  async refund(saleId, adminPasswordPlain, reason = null) {
    const rpc = await db.rpc('refund_sale', {
      p_sale_id: saleId, p_password: adminPasswordPlain,
      p_user: 'admin', p_reason: reason,
    });
    if (!rpc.error) return rpc.data;

    if (!dbMissing(rpc.error)) throw new Error(friendlyDbError(rpc.error));

    // v1 fallback (admin verified in UI): flag the sale FIRST — if that fails
    // (e.g. the migration hasn't been run) nothing has changed — then restore
    // stock. Marking first also blocks double refunds.
    const { data: sale, error: saleErr } = await db
      .from('sales').select('*, sale_items(product_id, quantity)').eq('id', saleId).single();
    if (saleErr) throw saleErr;
    if (sale.status === 'refunded') throw new Error(t('already_refunded'));

    const { data: updated, error: updErr } = await db.from('sales')
      .update({ status: 'refunded', refunded_at: new Date().toISOString(),
                refunded_by: 'admin', refund_reason: reason })
      .eq('id', saleId).eq('status', 'completed')   // no-op if already refunded
      .select().single();
    if (updErr) {
      if (dbMissing(updErr)) throw new Error(t('migration_needed'));
      throw updErr;
    }

    for (const item of (sale.sale_items || [])) {
      if (item.product_id) {
        try { await Products.adjustQuantity(item.product_id, +item.quantity); } catch (_) {}
      }
    }
    Logs.record('admin', 'refund',
      { sale_id: saleId, order_no: updated.order_no ?? null, total: updated.total_price, reason });
    return updated;
  },

  async listWithItems(limit = 200) {
    const { data, error } = await db
      .from('sales')
      .select('*, sale_items(quantity, price_at_sale, products(name, code))')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async since(isoDate) {
    const { data, error } = await db
      .from('sales')
      .select('total_price, created_at, status')
      .gte('created_at', isoDate);
    if (error) throw error;
    return data || [];
  },

  /* Aggregated top sellers via the sale_items table. */
  async topProducts(limit = 6) {
    const { data, error } = await db
      .from('sale_items')
      .select('quantity, products(name), sales!inner(status)');
    if (error) {
      // v1 DB without sales.status — fall back to the old query.
      if (!dbMissing(error)) throw error;
      return this._topProductsLegacy(limit);
    }
    const tally = {};
    for (const row of (data || [])) {
      if (row.sales?.status === 'refunded') continue;   // refunds don't count
      const name = row.products?.name || 'Unknown';
      tally[name] = (tally[name] || 0) + row.quantity;
    }
    return Object.entries(tally)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit);
  },

  async _topProductsLegacy(limit) {
    const { data, error } = await db.from('sale_items').select('quantity, products(name)');
    if (error) throw error;
    const tally = {};
    for (const row of (data || [])) {
      const name = row.products?.name || 'Unknown';
      tally[name] = (tally[name] || 0) + row.quantity;
    }
    return Object.entries(tally).map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty).slice(0, limit);
  },
};

/* ----------------------------------------------------------------------------
 *  Daily closing reports
 * -------------------------------------------------------------------------- */
const Reports = {
  /* Totals are computed inside the database (Cairo calendar day). */
  async closeDay(actualCash, adminPasswordPlain, notes = null) {
    const cash = Validate.cash(actualCash);
    if (cash === null) throw new Error(t('invalid_cash'));

    const rpc = await db.rpc('close_day', {
      p_actual_cash: cash, p_password: adminPasswordPlain,
      p_user: 'admin', p_notes: notes,
    });
    if (!rpc.error) return rpc.data;
    if (!dbMissing(rpc.error)) throw new Error(friendlyDbError(rpc.error));
    throw new Error(t('migration_needed'));
  },

  async list(limit = 60) {
    const { data, error } = await db.from('daily_reports')
      .select('*').order('report_date', { ascending: false }).limit(limit);
    if (error) {
      if (dbMissing(error)) return [];   // v1 DB — section simply shows empty
      throw error;
    }
    return data || [];
  },
};
