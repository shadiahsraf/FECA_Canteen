/* =============================================================================
 *  app.js  —  Shared utilities used across every page.
 *  Load order (in each HTML): supabase-cdn, config.js, supabase.js,
 *  cloudinary.js, app.js, then the page script (seller.js / admin.js).
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 *  Tiny DOM helpers
 * -------------------------------------------------------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const k of kids) node.append(k?.nodeType ? k : document.createTextNode(k ?? ''));
  return node;
};

/* ----------------------------------------------------------------------------
 *  Formatting
 * -------------------------------------------------------------------------- */
const money = (n) =>
  new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n) || 0) + ' ' + CONFIG.CURRENCY;

const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const shortId = (id) => (id || '').split('-')[0].toUpperCase();

/* ----------------------------------------------------------------------------
 *  Toasts
 * -------------------------------------------------------------------------- */
function toast(message, type = 'info', ms = 3200) {
  let host = $('#toast-host');
  if (!host) { host = el('div', { id: 'toast-host', className: 'toast-host' }); document.body.append(host); }
  const t = el('div', { className: `toast toast--${type}` });
  t.append(el('span', { className: 'toast__mark' }), el('span', { className: 'toast__msg', textContent: message }));
  host.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  const kill = () => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); };
  const timer = setTimeout(kill, ms);
  t.addEventListener('click', () => { clearTimeout(timer); kill(); });
}

/* ----------------------------------------------------------------------------
 *  Modals (generic + confirm + admin password prompt)
 * -------------------------------------------------------------------------- */
function openModal(contentNode, { onClose } = {}) {
  const overlay = el('div', { className: 'modal-overlay' });
  const panel = el('div', { className: 'modal', role: 'dialog', 'aria-modal': 'true' });
  panel.append(contentNode);
  overlay.append(panel);
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => overlay.classList.add('is-in'));

  let closed = false;
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onEsc);
    overlay.classList.remove('is-in');
    setTimeout(() => { overlay.remove(); document.body.style.overflow = ''; onClose?.(); }, 220);
  };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onEsc);
  return { overlay, panel, close };
}

function confirmDialog(title, message, { danger = false, confirmText = 'Confirm' } = {}) {
  return new Promise((resolve) => {
    const body = el('div', { className: 'modal-body' });
    body.append(
      el('h3', { className: 'modal-title', textContent: title }),
      el('p', { className: 'modal-text', textContent: message }),
    );
    const actions = el('div', { className: 'modal-actions' });
    const cancel = el('button', { className: 'btn btn--ghost', textContent: 'Cancel' });
    const ok = el('button', { className: `btn ${danger ? 'btn--danger' : 'btn--gold'}`, textContent: confirmText });
    actions.append(cancel, ok);
    body.append(actions);
    const m = openModal(body, { onClose: () => resolve(false) });
    cancel.onclick = () => { m.close(); };
    ok.onclick = () => { resolve(true); m.close(); };
  });
}

/* Prompts for the admin password and verifies it. Resolves to the plaintext
 * password on success (needed for the DB RPC), or null if cancelled/failed. */
function adminPrompt(reason = 'This action requires admin approval.') {
  return new Promise((resolve) => {
    const body = el('div', { className: 'modal-body' });
    const form = el('form', { className: 'modal-form' });
    const input = el('input', { type: 'password', className: 'field', placeholder: 'Admin password', autocomplete: 'off' });
    const errorLine = el('p', { className: 'field-error', textContent: '' });
    const actions = el('div', { className: 'modal-actions' });
    const cancel = el('button', { type: 'button', className: 'btn btn--ghost', textContent: 'Cancel' });
    const ok = el('button', { type: 'submit', className: 'btn btn--gold', textContent: 'Verify' });
    actions.append(cancel, ok);
    form.append(
      el('span', { className: 'modal-eyebrow', textContent: 'Admin approval' }),
      el('h3', { className: 'modal-title', textContent: 'Enter password' }),
      el('p', { className: 'modal-text', textContent: reason }),
      input, errorLine, actions,
    );
    body.append(form);
    const m = openModal(body, { onClose: () => resolve(null) });
    setTimeout(() => input.focus(), 60);
    cancel.onclick = () => { resolve(null); m.close(); };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const ok2 = await Auth.verify(input.value, CONFIG.ADMIN_PASSWORD_HASH);
      if (ok2) { const pw = input.value; sessionStorage.setItem('admin_ok', '1'); resolve(pw); m.close(); }
      else { errorLine.textContent = 'Incorrect password.'; input.select(); input.classList.add('shake');
             setTimeout(() => input.classList.remove('shake'), 400); }
    };
  });
}

/* ----------------------------------------------------------------------------
 *  Auth
 * -------------------------------------------------------------------------- */
const Auth = {
  async verify(plain, hash) {
    if (!plain) return false;
    return (await hashText(plain)) === hash;
  },
  async loginSeller(plain) {
    const ok = await this.verify(plain, CONFIG.SELLER_PASSWORD_HASH);
    if (ok) sessionStorage.setItem('seller_ok', '1');
    return ok;
  },
  isSeller() { return sessionStorage.getItem('seller_ok') === '1'; },
  isAdminVerified() { return sessionStorage.getItem('admin_ok') === '1'; },
  logout() { sessionStorage.removeItem('seller_ok'); sessionStorage.removeItem('admin_ok'); },
};

/* Page guards. Call at the top of protected page scripts. */
function requireSeller() {
  if (!Auth.isSeller()) { location.replace('index.html'); return false; }
  return true;
}

/* ----------------------------------------------------------------------------
 *  Config sanity check — warns clearly if keys are still placeholders
 * -------------------------------------------------------------------------- */
function configReady() {
  return !/YOUR-/.test(CONFIG.SUPABASE_URL + CONFIG.SUPABASE_ANON_KEY);
}
function warnIfUnconfigured() {
  if (!configReady()) {
    toast('Set your Supabase keys in js/config.js to load live data.', 'error', 6000);
    return false;
  }
  return true;
}

/* ----------------------------------------------------------------------------
 *  Login page wiring (only runs if a #login-form is on the page)
 * -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // stamp branding wherever these data-attributes appear
  $$('[data-brand-ar]').forEach(n => n.textContent = CONFIG.CHURCH_NAME_AR);
  $$('[data-brand-en]').forEach(n => n.textContent = CONFIG.CHURCH_NAME_EN);
  $$('[data-since]').forEach(n => n.textContent = 'منذ ' + CONFIG.SINCE);

  const form = $('#login-form');
  if (!form) return;

  if (Auth.isSeller()) { location.replace('seller.html'); return; }

  const input = $('#login-password', form);
  const errorLine = $('#login-error', form);
  const button = $('button[type="submit"]', form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorLine.textContent = '';
    button.disabled = true; button.classList.add('is-busy');
    const ok = await Auth.loginSeller(input.value);
    button.disabled = false; button.classList.remove('is-busy');
    if (ok) {
      document.body.classList.add('is-leaving');
      setTimeout(() => location.href = 'seller.html', 380);
    } else {
      errorLine.textContent = 'Incorrect password. Please try again.';
      input.select(); input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 420);
    }
  });
});
