/* =============================================================================
 *  admin.js  —  Admin dashboard: analytics, product management, sales history,
 *  refunds, daily closing, audit log.
 * ========================================================================== */
if (requireSeller()) {

  let PRODUCTS = [];
  let SALES = [];
  let REPORTS = [];
  let LOGS = [];
  let chartDaily = null, chartTop = null;
  let lowStockWarned = false;

  const LOW = () => CONFIG.LOW_STOCK_THRESHOLD ?? 5;
  const isRefunded = (s) => s.status === 'refunded';

  $('#logout-btn').onclick = () => { Auth.logout(); location.replace('index.html'); };

  /* ---- Admin gate -------------------------------------------------------- */
  if (Auth.isAdminVerified()) {
    revealDashboard();
  } else {
    $('#gate').hidden = false;
    $('#gate-btn').onclick = openGate;
    openGate();
  }

  async function openGate() {
    const pw = await adminPrompt(t('dashboard_reason'));
    if (pw) { $('#gate').hidden = true; revealDashboard(); }
    else { location.replace('seller.html'); }
  }

  async function revealDashboard() {
    $('#dashboard').hidden = false;
    $('#add-product-btn').onclick = () => openProductForm();
    $('#close-day-btn').onclick = openCloseDay;
    window.addEventListener('langchange', renderAll);
    if (!warnIfUnconfigured()) return;
    await refresh();
  }

  async function refresh() {
    try {
      [PRODUCTS, SALES, REPORTS, LOGS] = await Promise.all([
        Products.list(),
        Sales.listWithItems(300),
        Reports.list().catch(() => []),
        Logs.list(100).catch(() => []),
      ]);
      renderAll();
      warnLowStock();
    } catch (err) {
      console.error(err);
      toast(t('dashboard_load_failed'), 'error');
    }
  }

  function renderAll() {
    renderKPIs();
    renderDailyChart();
    renderTopChart();
    renderProductsTable();
    renderSalesTable();
    renderReportsTable();
    renderLogsTable();
  }

  function warnLowStock() {
    const low = PRODUCTS.filter(p => (p.quantity ?? 0) <= LOW());
    if (low.length && !lowStockWarned) {
      lowStockWarned = true;
      toast(t('low_stock_alert', { n: low.length }), 'error', 5200);
    }
  }

  /* ---- KPIs -------------------------------------------------------------- */
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

  function renderKPIs() {
    const today = startOfToday().getTime();
    const active = SALES.filter(s => !isRefunded(s));   // refunds don't count as revenue
    const todaySales = active.filter(s => new Date(s.created_at).getTime() >= today);
    const todayRevenue = todaySales.reduce((s, x) => s + Number(x.total_price), 0);
    const totalRevenue = active.reduce((s, x) => s + Number(x.total_price), 0);
    const lowStock = PRODUCTS.filter(p => (p.quantity ?? 0) <= LOW()).length;

    const kpis = [
      { label: t('today_revenue'), value: money(todayRevenue) },
      { label: t('today_orders'), value: todaySales.length },
      { label: t('total_revenue'), value: money(totalRevenue) },
      { label: t('low_stock_count'), value: lowStock },
    ];
    $('#kpis').innerHTML = kpis.map(k => `
      <div class="kpi"><div class="kpi__label">${k.label}</div>
      <div class="kpi__value">${k.value}</div></div>`).join('');
  }

  /* ---- Charts ------------------------------------------------------------ */
  const INK = '#141310', GOLD = '#b0894c', GOLD2 = '#c9a45c', LINE = '#e6e1d5', STONE = '#8b887e';
  const chartFont = () => ({ family: I18N.lang === 'ar' ? 'Tajawal' : 'Manrope' });

  function renderDailyChart() {
    const days = 14;
    const labels = [], revenue = [], orders = [];
    const active = SALES.filter(s => !isRefunded(s));
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const dayRows = active.filter(s => {
        const time = new Date(s.created_at).getTime();
        return time >= d.getTime() && time < next.getTime();
      });
      labels.push(fmtDate(d));
      revenue.push(Number(dayRows.reduce((a, s) => a + Number(s.total_price), 0).toFixed(2)));
      orders.push(dayRows.length);
    }
    chartDaily?.destroy();
    const ctx = $('#chart-daily').getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 260);
    grad.addColorStop(0, 'rgba(176,137,76,.28)');
    grad.addColorStop(1, 'rgba(176,137,76,0)');
    chartDaily = new Chart(ctx, {
      data: {
        labels,
        datasets: [
          { type: 'line', label: t('revenue_series'), data: revenue, yAxisID: 'y',
            fill: true, backgroundColor: grad, borderColor: GOLD, borderWidth: 2,
            tension: .35, pointRadius: 3, pointBackgroundColor: INK, pointHoverRadius: 5 },
          { type: 'bar', label: t('orders_series'), data: orders, yAxisID: 'y1',
            backgroundColor: 'rgba(20,19,16,.14)', hoverBackgroundColor: 'rgba(20,19,16,.3)',
            borderRadius: 4, maxBarThickness: 14 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: STONE, font: chartFont(), boxWidth: 12 } },
          tooltip: {
            backgroundColor: INK, padding: 10, titleFont: chartFont(), bodyFont: chartFont(),
            callbacks: {
              label: (c) => c.dataset.yAxisID === 'y'
                ? ` ${t('revenue_series')}: ${money(c.parsed.y)}`
                : ` ${t('orders_series')}: ${c.parsed.y}`,
            },
          },
        },
        scales: {
          x:  { grid: { display: false }, ticks: { color: STONE, font: chartFont(), maxRotation: 0 } },
          y:  { grid: { color: LINE }, border: { display: false }, ticks: { color: STONE, font: chartFont() } },
          y1: { position: I18N.lang === 'ar' ? 'left' : 'right', grid: { display: false },
                border: { display: false }, ticks: { color: STONE, font: chartFont(), precision: 0 } },
        },
      },
    });
  }

  async function renderTopChart() {
    let top = [];
    try { top = await Sales.topProducts(6); } catch (_) { top = []; }
    chartTop?.destroy();
    const ctx = $('#chart-top').getContext('2d');
    chartTop = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(x => x.name),
        datasets: [{ data: top.map(x => x.qty), backgroundColor: INK, hoverBackgroundColor: GOLD,
          borderRadius: 6, maxBarThickness: 26 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: INK, padding: 10, titleFont: chartFont(), bodyFont: chartFont() },
        },
        scales: {
          x: { grid: { color: LINE }, border: { display: false }, ticks: { color: STONE, font: chartFont(), precision: 0 } },
          y: { grid: { display: false }, ticks: { color: STONE, font: chartFont() } },
        },
      },
    });
  }

  /* ---- Products table ---------------------------------------------------- */
  function renderProductsTable() {
    const tbody = $('#products-table tbody');
    if (!PRODUCTS.length) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--stone);padding:24px">${t('no_products')}</td></tr>`; return; }
    tbody.innerHTML = '';
    PRODUCTS.forEach(p => {
      const low = (p.quantity ?? 0) <= LOW();
      const tr = el('tr');
      tr.innerHTML = `
        <td>${p.image_url ? `<img class="thumb" src="${Cloudinary.thumb(p.image_url, 80)}" alt="">` : `<div class="thumb"></div>`}</td>
        <td style="font-weight:600">${esc(p.name)}</td>
        <td style="font-variant-numeric:tabular-nums">${esc(p.code || '—')}</td>
        <td><span class="badge badge--cat">${esc(p.category || '—')}</span></td>
        <td class="num"><span class="pill-gold">${Number(p.price).toFixed(2)}</span></td>
        <td class="num"><span class="badge ${low ? 'badge--low' : 'badge--ok'}">${p.quantity ?? 0}</span></td>`;
      const actions = el('td', { className: 'num' });
      const wrap = el('div', { className: 'row-actions' });
      const edit = el('button', { className: 'btn btn--ghost btn--sm', textContent: t('edit') });
      const del = el('button', { className: 'btn btn--danger btn--sm', textContent: t('delete') });
      edit.onclick = () => openProductForm(p);
      del.onclick = () => removeProduct(p);
      wrap.append(edit, del); actions.append(wrap); tr.append(actions);
      tbody.append(tr);
    });
  }

  /* Soft delete — admin gated, logged, reversible in the database. */
  async function removeProduct(p) {
    const ok = await confirmDialog(t('delete_product_title'), t('delete_product_msg', { name: p.name }),
      { danger: true, confirmText: t('delete') });
    if (!ok) return;
    const pw = await adminPrompt(t('delete_reason'));
    if (!pw) return;
    try { await Products.remove(p.id, p.name); toast(t('product_deleted'), 'success'); await refresh(); }
    catch (err) { console.error(err); toast(err.message || t('delete_failed'), 'error'); }
  }

  /* ---- Product form (add / edit) ---------------------------------------- */
  function openProductForm(product = null) {
    const isEdit = !!product;
    let uploadedUrl = product?.image_url || '';
    let priceUnlocked = !isEdit;        // new products: price editable; edits: locked
    let adminPw = null;

    const body = el('div', { className: 'modal-body' });
    body.innerHTML = `
      <span class="modal-eyebrow">${isEdit ? t('edit_product') : t('new_product')}</span>
      <h3 class="modal-title">${isEdit ? esc(product.name) : t('add_to_canteen')}</h3>`;

    const form = el('form', { className: 'pform' });
    form.innerHTML = `
      <div>
        <label class="lbl">${t('product_name')}</label>
        <input class="field" name="name" required maxlength="120" value="${isEdit ? esc(product.name) : ''}" />
      </div>
      <div class="pform__row">
        <div><label class="lbl">${t('category')}</label>
          <input class="field" name="category" list="catlist" maxlength="60" value="${isEdit ? esc(product.category || '') : ''}" /></div>
        <div><label class="lbl">${t('code')}</label>
          <input class="field" name="code" maxlength="40" value="${isEdit ? esc(product.code || '') : ''}" /></div>
      </div>
      <datalist id="catlist">${[...new Set(PRODUCTS.map(p => p.category).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="pform__row">
        <div><label class="lbl">${t('stock_qty')}</label>
          <input class="field" name="quantity" type="number" min="0" max="100000" step="1" value="${isEdit ? (product.quantity ?? 0) : 0}" /></div>
        <div>
          <label class="lbl">${t('price_lbl', { cur: t('currency') })}</label>
          <input class="field" name="price" type="number" min="0" max="100000" step="0.01" value="${isEdit ? Number(product.price).toFixed(2) : ''}" ${priceUnlocked ? '' : 'disabled'} />
          ${isEdit ? `<button type="button" class="price-lock" id="unlock-price" style="margin-top:6px;background:none;border:0">${t('unlock_price')}</button>` : ''}
        </div>
      </div>
      <div>
        <label class="lbl">${t('product_image')}</label>
        <div class="pform__drop" id="drop">
          <img class="pform__preview" id="preview" ${uploadedUrl ? `src="${Cloudinary.thumb(uploadedUrl, 200)}"` : 'hidden'} alt="" />
          <div id="drop-text">${t('tap_upload')}</div>
          <div class="pform__progress" id="prog" hidden><i id="prog-bar"></i></div>
          <input type="file" accept="image/*" id="file" style="position:absolute;inset:0;opacity:0;cursor:pointer" />
        </div>
      </div>`;

    const actions = el('div', { className: 'modal-actions' });
    const cancel = el('button', { type: 'button', className: 'btn btn--ghost', textContent: t('cancel') });
    const save = el('button', { type: 'submit', className: 'btn btn--gold', textContent: isEdit ? t('save_changes') : t('add_product_btn') });
    actions.append(cancel, save);
    form.append(actions);
    body.append(form);

    const m = openModal(body);
    cancel.onclick = m.close;

    // image upload
    const fileInput = $('#file', form);
    const preview = $('#preview', form);
    const dropText = $('#drop-text', form);
    const prog = $('#prog', form);
    const progBar = $('#prog-bar', form);
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (!configReady()) { toast(t('configure_cloudinary'), 'error'); return; }
      prog.hidden = false; progBar.style.width = '0%'; save.disabled = true;
      try {
        uploadedUrl = await Cloudinary.upload(file, (pct) => { progBar.style.width = pct + '%'; });
        preview.src = Cloudinary.thumb(uploadedUrl, 200); preview.hidden = false;
        dropText.textContent = t('tap_replace');
        toast(t('image_uploaded'), 'success');
      } catch (err) { console.error(err); toast(err.message || t('upload_failed'), 'error'); }
      finally { prog.hidden = true; save.disabled = false; }
    };

    // price unlock (edit mode) — requires the admin password
    const unlockBtn = $('#unlock-price', form);
    const priceInput = form.price;
    if (unlockBtn) unlockBtn.onclick = async () => {
      const pw = await adminPrompt(t('price_change_reason'));
      if (pw) { adminPw = pw; priceUnlocked = true; priceInput.disabled = false; priceInput.focus();
        unlockBtn.textContent = t('price_unlocked'); unlockBtn.style.color = 'var(--ok)'; }
    };

    // submit — validate everything before touching the database
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      if (!name) { toast(t('name_required'), 'error'); return; }

      const qty = Number(fd.get('quantity'));
      if (!Number.isInteger(qty) || qty < 0 || qty > 100000) { toast(t('invalid_qty'), 'error'); return; }

      const rawPrice = fd.get('price');
      const newPrice = parseFloat(rawPrice);
      if (priceUnlocked && rawPrice !== '' && (!Number.isFinite(newPrice) || newPrice < 0 || newPrice > 100000)) {
        toast(t('invalid_price'), 'error'); return;
      }

      const payload = {
        name,
        category: String(fd.get('category') || '').trim() || null,
        code: String(fd.get('code') || '').trim() || null,
        quantity: qty,
        image_url: uploadedUrl || null,
      };
      save.disabled = true; save.classList.add('is-busy');
      try {
        if (!isEdit) {
          payload.price = Number.isFinite(newPrice) ? newPrice : 0;
          await Products.create(payload);
          toast(t('product_added'), 'success');
        } else {
          const priceChanged = Number.isFinite(newPrice) && Number(newPrice) !== Number(product.price);
          if (priceChanged && !adminPw) {
            toast(t('unlock_price_first'), 'error');
            save.disabled = false; save.classList.remove('is-busy'); return;
          }
          await Products.update(product.id, payload, product);
          if (priceChanged) {
            // Verified in the DB when the RPC is installed; logs old → new price.
            await Products.updatePrice(product.id, newPrice, adminPw, Number(product.price));
          }
          toast(t('changes_saved'), 'success');
        }
        m.close();
        await refresh();
      } catch (err) {
        console.error(err); toast(err.message || t('save_failed'), 'error');
      } finally { save.disabled = false; save.classList.remove('is-busy'); }
    };
  }

  /* ---- Sales history + refunds ------------------------------------------ */
  function renderSalesTable() {
    const tbody = $('#sales-table tbody');
    if (!SALES.length) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--stone);padding:24px">${t('no_sales')}</td></tr>`; return; }
    tbody.innerHTML = '';
    SALES.forEach(s => {
      const items = (s.sale_items || []);
      const itemCount = items.reduce((a, i) => a + i.quantity, 0);
      const names = items.map(i => `${i.products?.name || '—'} ×${i.quantity}`).join('، ');
      const refunded = isRefunded(s);
      const tr = el('tr', { className: refunded ? 'is-refunded' : '' });
      tr.innerHTML = `
        <td style="font-weight:700">#${orderNo(s)}</td>
        <td>${fmtDateTime(s.created_at)}</td>
        <td style="max-width:320px;color:var(--ink-soft)">${esc(names || t('item_count', { n: itemCount }))}</td>
        <td>${esc(s.seller_name || '—')}</td>
        <td><span class="badge ${refunded ? 'badge--low' : 'badge--ok'}">${refunded ? t('refunded') : t('completed')}</span></td>
        <td class="num"><span class="pill-gold" style="${refunded ? 'text-decoration:line-through;opacity:.6' : ''}">${money(s.total_price)}</span></td>`;
      const actions = el('td', { className: 'num' });
      if (!refunded) {
        const btn = el('button', { className: 'btn btn--ghost btn--sm', textContent: t('refund') });
        btn.onclick = () => openRefund(s);
        actions.append(btn);
      }
      tr.append(actions);
      tbody.append(tr);
    });
  }

  /* Refund flow: reason → admin password → server-side refund + stock restore. */
  function openRefund(sale) {
    const body = el('div', { className: 'modal-body' });
    const form = el('form', { className: 'modal-form' });
    const reason = el('input', { className: 'field', placeholder: t('refund_reason_ph'), maxLength: 200 });
    const actions = el('div', { className: 'modal-actions' });
    const cancel = el('button', { type: 'button', className: 'btn btn--ghost', textContent: t('cancel') });
    const ok = el('button', { type: 'submit', className: 'btn btn--danger', textContent: t('refund') });
    actions.append(cancel, ok);
    form.append(
      el('span', { className: 'modal-eyebrow', textContent: t('refund_sale_title') }),
      el('h3', { className: 'modal-title', textContent: `#${orderNo(sale)}` }),
      el('p', { className: 'modal-text', textContent: t('refund_sale_msg', { order: orderNo(sale), total: money(sale.total_price) }) }),
      el('label', { className: 'lbl', textContent: t('refund_reason_lbl') }),
      reason, actions,
    );
    body.append(form);
    const m = openModal(body);
    cancel.onclick = m.close;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const pw = await adminPrompt(t('refund_needs_admin'));
      if (!pw) return;
      ok.disabled = true; ok.classList.add('is-busy');
      try {
        await Sales.refund(sale.id, pw, reason.value.trim() || null);
        toast(t('refund_done'), 'success');
        m.close();
        await refresh();
      } catch (err) {
        console.error(err); toast(err.message || t('refund_failed'), 'error');
      } finally { ok.disabled = false; ok.classList.remove('is-busy'); }
    };
  }

  /* ---- Daily closing ----------------------------------------------------- */
  function openCloseDay() {
    const today = startOfToday().getTime();
    const todaySales = SALES.filter(s => !isRefunded(s) && new Date(s.created_at).getTime() >= today);
    const expected = todaySales.reduce((s, x) => s + Number(x.total_price), 0);

    const body = el('div', { className: 'modal-body' });
    const form = el('form', { className: 'modal-form' });
    const cash = el('input', { className: 'field', type: 'number', min: '0', step: '0.01', required: true, placeholder: '0.00' });
    const notes = el('input', { className: 'field', placeholder: '', maxLength: 300 });
    const diffLine = el('p', { className: 'modal-text', style: 'font-weight:700' });
    const actions = el('div', { className: 'modal-actions' });
    const cancel = el('button', { type: 'button', className: 'btn btn--ghost', textContent: t('cancel') });
    const ok = el('button', { type: 'submit', className: 'btn btn--gold', textContent: t('close_day_btn') });
    actions.append(cancel, ok);

    const updateDiff = () => {
      const v = parseFloat(cash.value);
      if (!Number.isFinite(v)) { diffLine.textContent = ''; return; }
      const d = v - expected;
      diffLine.textContent = `${t('difference_lbl')}: ${money(d)}`;
      diffLine.style.color = d < 0 ? 'var(--danger)' : 'var(--ok)';
    };
    cash.addEventListener('input', updateDiff);

    form.append(
      el('span', { className: 'modal-eyebrow', textContent: t('close_day') }),
      el('h3', { className: 'modal-title', textContent: t('close_day_title') }),
      el('p', { className: 'modal-text', textContent: t('close_day_intro') }),
      el('p', { className: 'modal-text', textContent: `${t('expected_cash')}: ${money(expected)} · ${t('orders_today')}: ${todaySales.length}` }),
      el('label', { className: 'lbl', textContent: t('actual_cash_lbl', { cur: t('currency') }) }),
      cash, diffLine,
      el('label', { className: 'lbl', textContent: t('notes_lbl') }),
      notes, actions,
    );
    body.append(form);
    const m = openModal(body);
    cancel.onclick = m.close;
    setTimeout(() => cash.focus(), 60);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const v = parseFloat(cash.value);
      if (!Number.isFinite(v) || v < 0) { toast(t('invalid_cash'), 'error'); return; }
      const pw = await adminPrompt(t('close_day_reason'));
      if (!pw) return;
      ok.disabled = true; ok.classList.add('is-busy');
      try {
        // Totals are recomputed server-side for the Cairo calendar day.
        await Reports.closeDay(v, pw, notes.value.trim() || null);
        toast(t('day_closed'), 'success');
        m.close();
        await refresh();
      } catch (err) {
        console.error(err); toast(err.message || t('close_day_failed'), 'error');
      } finally { ok.disabled = false; ok.classList.remove('is-busy'); }
    };
  }

  function renderReportsTable() {
    const tbody = $('#reports-table tbody');
    if (!REPORTS.length) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--stone);padding:24px">${t('no_reports')}</td></tr>`; return; }
    tbody.innerHTML = '';
    REPORTS.forEach(r => {
      const diff = Number(r.difference);
      const tr = el('tr');
      tr.innerHTML = `
        <td style="font-weight:600">${fmtDate(r.report_date)}</td>
        <td class="num">${r.orders_count}</td>
        <td class="num">${money(r.expected_cash)}</td>
        <td class="num">${money(r.actual_cash)}</td>
        <td class="num"><span class="badge ${diff < 0 ? 'badge--low' : 'badge--ok'}">${money(diff)}</span></td>
        <td>${esc(r.closed_by || '—')}</td>
        <td style="max-width:240px;color:var(--ink-soft)">${esc(r.notes || '—')}</td>`;
      tbody.append(tr);
    });
  }

  /* ---- Audit log --------------------------------------------------------- */
  function renderLogsTable() {
    const tbody = $('#logs-table tbody');
    if (!LOGS.length) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--stone);padding:24px">${t('no_logs')}</td></tr>`; return; }
    tbody.innerHTML = '';
    LOGS.forEach(l => {
      const tr = el('tr');
      tr.innerHTML = `
        <td style="white-space:nowrap">${fmtDateTime(l.created_at)}</td>
        <td>${esc(l.user_name)}</td>
        <td><span class="badge badge--cat">${esc(t('action_' + l.action) === 'action_' + l.action ? l.action : t('action_' + l.action))}</span></td>
        <td style="max-width:420px;color:var(--ink-soft);font-size:.8rem">${esc(logSummary(l))}</td>`;
      tbody.append(tr);
    });
  }

  function logSummary(l) {
    const d = l.details || {};
    switch (l.action) {
      case 'sale':          return `#${d.order_no ?? shortId(d.sale_id)} — ${money(d.total)}`;
      case 'refund':        return `#${d.order_no ?? shortId(d.sale_id)} — ${money(d.total)}${d.reason ? ` — ${d.reason}` : ''}`;
      case 'price_change':  return `${d.name}: ${money(d.old_price)} → ${money(d.new_price)}`;
      case 'daily_close':   return `${d.date} — ${t('actual')}: ${money(d.actual_cash)} · ${t('difference')}: ${money(d.difference)}`;
      case 'product_add':
      case 'product_delete': return d.name || '';
      case 'product_update': return `${d.name || ''}${d.changes ? ' — ' + Object.keys(d.changes).join(', ') : ''}`;
      case 'login':          return d.role || '';
      default: {
        const s = JSON.stringify(d);
        return s.length > 120 ? s.slice(0, 120) + '…' : s;
      }
    }
  }

  /* ---- utils ------------------------------------------------------------- */
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
}
