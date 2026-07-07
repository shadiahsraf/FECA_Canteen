/* =============================================================================
 *  supabase.js  —  Database access layer.
 *  Requires the Supabase JS client (loaded via CDN in each HTML page) and
 *  config.js to be loaded first.
 * ========================================================================== */

/* The global `supabase` from the CDN exposes createClient. */
const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* ----------------------------------------------------------------------------
 *  Products
 * -------------------------------------------------------------------------- */
const Products = {
  async list() {
    const { data, error } = await db
      .from('products')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async create(product) {
    const { data, error } = await db.from('products').insert(product).select().single();
    if (error) throw error;
    return data;
  },

  /* Updates everything EXCEPT price. Price has its own admin-gated path. */
  async update(id, fields) {
    const { price, ...safe } = fields; // never update price here
    const { data, error } = await db.from('products').update(safe).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /* Admin-gated price change. If the `update_product_price` RPC exists (see
   * schema.sql, optional hardening) it is used so the check happens in the
   * database; otherwise it falls back to a direct update. */
  async updatePrice(id, newPrice, adminPasswordPlain) {
    const rpc = await db.rpc('update_product_price', {
      p_id: id,
      p_price: newPrice,
      p_password: adminPasswordPlain,
    });
    if (!rpc.error) return rpc.data;

    // RPC not installed — fall back to a plain update (admin already verified in UI).
    if (rpc.error.code === '42883' || /function .* does not exist/i.test(rpc.error.message)) {
      const { data, error } = await db
        .from('products').update({ price: newPrice }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    throw rpc.error;
  },

  async remove(id) {
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  async adjustQuantity(id, delta) {
    // Read-modify-write. For a small single-till canteen this is sufficient.
    const { data: row, error: readErr } = await db
      .from('products').select('quantity').eq('id', id).single();
    if (readErr) throw readErr;
    const next = Math.max(0, (row.quantity || 0) + delta);
    const { error } = await db.from('products').update({ quantity: next }).eq('id', id);
    if (error) throw error;
    return next;
  },
};

/* ----------------------------------------------------------------------------
 *  Sales + checkout
 * -------------------------------------------------------------------------- */
const Sales = {
  /* cart: [{ id, name, price, quantity }]  ->  saves sale, items, decrements stock */
  async checkout(cart, sellerName) {
    if (!cart.length) throw new Error('Cart is empty.');
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

    const { data: sale, error: saleErr } = await db
      .from('sales')
      .insert({ total_price: total, seller_name: sellerName })
      .select()
      .single();
    if (saleErr) throw saleErr;

    const items = cart.map(i => ({
      sale_id: sale.id,
      product_id: i.id,
      quantity: i.quantity,
      price_at_sale: i.price,
    }));
    const { error: itemsErr } = await db.from('sale_items').insert(items);
    if (itemsErr) throw itemsErr;

    // Decrement stock (best-effort, sequential to keep it simple).
    for (const i of cart) {
      try { await Products.adjustQuantity(i.id, -i.quantity); } catch (_) { /* ignore stock race */ }
    }

    return { ...sale, items: cart, total_price: total };
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
      .select('total_price, created_at')
      .gte('created_at', isoDate);
    if (error) throw error;
    return data || [];
  },

  /* Aggregated top sellers via the sale_items table. */
  async topProducts(limit = 6) {
    const { data, error } = await db
      .from('sale_items')
      .select('quantity, products(name)');
    if (error) throw error;
    const tally = {};
    for (const row of (data || [])) {
      const name = row.products?.name || 'Unknown';
      tally[name] = (tally[name] || 0) + row.quantity;
    }
    return Object.entries(tally)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit);
  },
};
