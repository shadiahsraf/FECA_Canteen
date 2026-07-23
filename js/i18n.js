/* =============================================================================
 *  i18n.js  —  Simple JSON-based translation system. Arabic-first (RTL) with
 *  optional English. Load BEFORE app.js and the page scripts.
 *
 *  Usage:
 *    t('sale_completed')                 → translated string
 *    t('only_x_left', { n: 3, name })    → with {placeholders}
 *    I18N.set('en')                      → switch language (fires 'langchange')
 *    HTML:  <span data-i18n="nav_pos"></span>
 *           data-i18n-placeholder / data-i18n-aria / data-i18n-title
 * ========================================================================== */

const I18N_DICT = {
  /* -------------------------------------------------------------- Arabic -- */
  "ar": {
    "_dir": "rtl",
    "_name": "عربي",
    "currency": "ج.م",
    "lang_toggle": "English",

    "canteen_access": "الدخول إلى الكانتين",
    "password_placeholder": "أدخل كلمة المرور",
    "enter_btn": "دخول الكانتين",
    "wrong_password": "كلمة المرور غير صحيحة. حاول مرة أخرى.",

    "nav_pos": "نقطة البيع",
    "nav_admin": "الإدارة",
    "sign_out": "تسجيل الخروج",
    "pos_sub": "الكانتين · نقطة البيع",
    "admin_sub": "الكانتين · لوحة الإدارة",
    "logged_out_inactivity": "تم تسجيل الخروج تلقائيًا بسبب عدم النشاط.",

    "search_placeholder": "ابحث عن منتج أو كود…",
    "all": "الكل",
    "current_order": "الطلب الحالي",
    "tray_title": "السلة",
    "no_items": "لا توجد أصناف بعد. اضغط على منتج للبدء.",
    "clear": "تفريغ",
    "complete_sale": "إتمام البيع",
    "view_tray": "عرض السلة",
    "out": "نفد",
    "x_left": "متبقي {n}",
    "each": "{price} للواحدة",
    "only_x_left": "متوفر فقط {n} من «{name}».",
    "only_x_stock": "المتاح في المخزون {n} فقط.",
    "no_products": "لا توجد منتجات بعد.",
    "no_match": "لا توجد منتجات مطابقة لبحثك.",
    "add_supabase_keys": "أضف مفاتيح Supabase لتحميل المنتجات.",
    "load_failed": "تعذر تحميل المنتجات. تحقق من إعدادات Supabase.",
    "load_failed_toast": "فشل تحميل المنتجات.",
    "sale_completed": "تم البيع بنجاح.",
    "checkout_failed": "فشل إتمام البيع.",
    "supabase_not_configured": "لم يتم ضبط إعدادات Supabase.",
    "stock_changed": "تغيّر المخزون — تم تحديث المنتجات، راجع السلة.",

    "receipt": "الإيصال",
    "receipt_title": "إيصال الكانتين",
    "order_label": "طلب رقم",
    "item": "الصنف",
    "qty": "الكمية",
    "price": "السعر",
    "sum": "الإجمالي",
    "total": "الإجمالي",
    "thanks": "شكرًا لكم · بارك الله فيكم",
    "print_receipt": "طباعة الإيصال",
    "close": "إغلاق",
    "refunded_stamp": "مسترجَع",

    "restricted": "منطقة محظورة",
    "admin_verification": "مطلوب التحقق من المشرف",
    "enter_admin_password": "أدخل كلمة مرور المشرف",
    "admin_approval": "موافقة المشرف",
    "enter_password": "أدخل كلمة المرور",
    "verify": "تحقق",
    "cancel": "إلغاء",
    "confirm": "تأكيد",
    "incorrect_password": "كلمة المرور غير صحيحة.",
    "dashboard_reason": "أدخل كلمة مرور المشرف لفتح لوحة الإدارة.",
    "price_change_reason": "تغيير السعر يتطلب كلمة مرور المشرف.",

    "overview": "نظرة عامة",
    "ledger_title": "السجل",
    "today_revenue": "إيراد اليوم",
    "today_orders": "طلبات اليوم",
    "total_revenue": "إجمالي الإيراد",
    "low_stock_count": "منتجات قاربت على النفاد",
    "low_stock_alert": "{n} منتج/منتجات قاربت على النفاد — راجع المخزون.",
    "sales_14": "المبيعات · آخر ١٤ يومًا",
    "orders_series": "عدد الطلبات",
    "revenue_series": "الإيراد",
    "top_sellers": "الأكثر مبيعًا",

    "products": "المنتجات",
    "add_product": "+ إضافة منتج",
    "image": "الصورة",
    "name": "الاسم",
    "code": "الكود",
    "category": "الفئة",
    "price_th": "السعر",
    "stock": "المخزون",
    "actions": "إجراءات",
    "edit": "تعديل",
    "delete": "حذف",

    "sales_history": "سجل المبيعات",
    "no_sales": "لا توجد مبيعات مسجلة بعد.",
    "order": "الطلب",
    "datetime": "التاريخ والوقت",
    "items": "الأصناف",
    "seller": "البائع",
    "total_th": "الإجمالي",
    "status": "الحالة",
    "completed": "مكتمل",
    "refunded": "مسترجَع",
    "refund": "استرجاع",
    "item_count": "{n} صنف",

    "new_product": "منتج جديد",
    "edit_product": "تعديل منتج",
    "add_to_canteen": "إضافة إلى الكانتين",
    "product_name": "اسم المنتج",
    "stock_qty": "الكمية بالمخزون",
    "price_lbl": "السعر ({cur})",
    "unlock_price": "🔒 فتح السعر بكلمة مرور المشرف",
    "price_unlocked": "🔓 السعر مفتوح للتعديل",
    "product_image": "صورة المنتج",
    "tap_upload": "اضغط لرفع صورة → Cloudinary",
    "image_uploaded": "تم رفع الصورة.",
    "tap_replace": "تم رفع الصورة — اضغط للاستبدال",
    "upload_failed": "فشل رفع الصورة.",
    "configure_cloudinary": "اضبط إعدادات Cloudinary في js/config.js أولًا.",
    "save_changes": "حفظ التعديلات",
    "add_product_btn": "إضافة المنتج",
    "name_required": "اسم المنتج مطلوب.",
    "invalid_price": "السعر غير صحيح.",
    "invalid_qty": "الكمية غير صحيحة (عدد صحيح ≥ 0).",
    "product_added": "تمت إضافة المنتج.",
    "changes_saved": "تم حفظ التعديلات.",
    "save_failed": "فشل الحفظ.",
    "unlock_price_first": "افتح السعر بكلمة مرور المشرف لتغييره.",

    "delete_product_title": "حذف منتج",
    "delete_product_msg": "سيتم إخفاء «{name}» من نقطة البيع (حذف آمن — يبقى في السجلات). متابعة؟",
    "delete_reason": "حذف منتج يتطلب كلمة مرور المشرف.",
    "product_deleted": "تم حذف المنتج (حذف آمن).",
    "delete_failed": "فشل الحذف.",

    "refund_sale_title": "استرجاع بيع",
    "refund_sale_msg": "استرجاع الطلب رقم {order} بقيمة {total}؟ ستُعاد الكميات إلى المخزون ويُسجَّل الإجراء.",
    "refund_reason_lbl": "سبب الاسترجاع (اختياري)",
    "refund_reason_ph": "مثال: طلب خاطئ",
    "refund_done": "تم الاسترجاع وإعادة الكميات للمخزون.",
    "refund_failed": "فشل الاسترجاع.",
    "already_refunded": "هذا الطلب مسترجَع بالفعل.",
    "refund_needs_admin": "الاسترجاع يتطلب كلمة مرور المشرف.",

    "daily_reports": "تقارير الإغلاق اليومي",
    "close_day": "إغلاق اليوم",
    "close_day_title": "إغلاق اليوم",
    "close_day_intro": "راجع أرقام اليوم ثم أدخل النقدية الفعلية في الدرج.",
    "expected_cash": "النقدية المتوقعة",
    "orders_today": "عدد الطلبات",
    "actual_cash_lbl": "النقدية الفعلية ({cur})",
    "difference_lbl": "الفرق",
    "notes_lbl": "ملاحظات (اختياري)",
    "close_day_btn": "إغلاق اليوم وحفظ التقرير",
    "close_day_reason": "إغلاق اليوم يتطلب كلمة مرور المشرف.",
    "day_closed": "تم إغلاق اليوم وحفظ التقرير.",
    "day_already_closed": "تم إغلاق هذا اليوم بالفعل.",
    "close_day_failed": "فشل إغلاق اليوم.",
    "invalid_cash": "أدخل مبلغًا نقديًا صحيحًا.",
    "date": "التاريخ",
    "orders_count": "الطلبات",
    "expected": "المتوقع",
    "actual": "الفعلي",
    "difference": "الفرق",
    "closed_by": "أغلقه",
    "notes": "ملاحظات",
    "no_reports": "لا توجد تقارير إغلاق بعد.",

    "audit_log": "سجل التدقيق",
    "time": "الوقت",
    "user": "المستخدم",
    "action": "الإجراء",
    "details": "التفاصيل",
    "no_logs": "لا توجد سجلات بعد.",
    "action_sale": "بيع",
    "action_refund": "استرجاع",
    "action_price_change": "تغيير سعر",
    "action_daily_close": "إغلاق يومي",
    "action_product_add": "إضافة منتج",
    "action_product_update": "تعديل منتج",
    "action_product_delete": "حذف منتج",
    "action_login": "تسجيل دخول",

    "dashboard_load_failed": "فشل تحميل بيانات اللوحة.",
    "err_insufficient_stock": "المخزون غير كافٍ لـ «{name}» (المتاح {n}).",
    "err_product_not_found": "أحد المنتجات لم يعد متاحًا.",
    "err_empty_cart": "السلة فارغة.",
    "err_invalid_admin": "كلمة مرور المشرف غير صحيحة.",
    "err_generic": "حدث خطأ. حاول مرة أخرى.",
    "migration_needed": "قاعدة البيانات تحتاج للتحديث — شغّل migration.sql ثم schema.sql."
  },

  /* ------------------------------------------------------------- English -- */
  "en": {
    "_dir": "ltr",
    "_name": "English",
    "currency": "EGP",
    "lang_toggle": "عربي",

    "canteen_access": "Canteen access",
    "password_placeholder": "Enter password",
    "enter_btn": "Enter the canteen",
    "wrong_password": "Incorrect password. Please try again.",

    "nav_pos": "POS",
    "nav_admin": "Admin",
    "sign_out": "Sign out",
    "pos_sub": "Canteen · Point of Sale",
    "admin_sub": "Canteen · Administration",
    "logged_out_inactivity": "Signed out automatically due to inactivity.",

    "search_placeholder": "Search products or code…",
    "all": "All",
    "current_order": "Current order",
    "tray_title": "The Tray",
    "no_items": "No items yet. Tap a product to begin.",
    "clear": "Clear",
    "complete_sale": "Complete sale",
    "view_tray": "View tray",
    "out": "Out",
    "x_left": "{n} left",
    "each": "{price} each",
    "only_x_left": "Only {n} of \"{name}\" in stock.",
    "only_x_stock": "Only {n} in stock.",
    "no_products": "No products yet.",
    "no_match": "No products match your search.",
    "add_supabase_keys": "Add your Supabase keys to load products.",
    "load_failed": "Could not load products. Check your Supabase setup.",
    "load_failed_toast": "Failed to load products.",
    "sale_completed": "Sale completed.",
    "checkout_failed": "Checkout failed.",
    "supabase_not_configured": "Supabase is not configured.",
    "stock_changed": "Stock changed — products refreshed, please review the tray.",

    "receipt": "Receipt",
    "receipt_title": "Canteen Receipt",
    "order_label": "Order no.",
    "item": "Item",
    "qty": "Qty",
    "price": "Price",
    "sum": "Sum",
    "total": "Total",
    "thanks": "Thank you · بارك الله فيكم",
    "print_receipt": "Print receipt",
    "close": "Close",
    "refunded_stamp": "REFUNDED",

    "restricted": "Restricted",
    "admin_verification": "Admin verification required",
    "enter_admin_password": "Enter admin password",
    "admin_approval": "Admin approval",
    "enter_password": "Enter password",
    "verify": "Verify",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "incorrect_password": "Incorrect password.",
    "dashboard_reason": "Enter the admin password to open the dashboard.",
    "price_change_reason": "Changing a price requires the admin password.",

    "overview": "Overview",
    "ledger_title": "The Ledger",
    "today_revenue": "Today's revenue",
    "today_orders": "Today's orders",
    "total_revenue": "Total revenue",
    "low_stock_count": "Products low on stock",
    "low_stock_alert": "{n} product(s) are low on stock — review inventory.",
    "sales_14": "Sales · last 14 days",
    "orders_series": "Orders",
    "revenue_series": "Revenue",
    "top_sellers": "Top sellers",

    "products": "Products",
    "add_product": "+ Add product",
    "image": "Image",
    "name": "Name",
    "code": "Code",
    "category": "Category",
    "price_th": "Price",
    "stock": "Stock",
    "actions": "Actions",
    "edit": "Edit",
    "delete": "Delete",

    "sales_history": "Sales history",
    "no_sales": "No sales recorded yet.",
    "order": "Order",
    "datetime": "Date & time",
    "items": "Items",
    "seller": "Seller",
    "total_th": "Total",
    "status": "Status",
    "completed": "Completed",
    "refunded": "Refunded",
    "refund": "Refund",
    "item_count": "{n} item(s)",

    "new_product": "New product",
    "edit_product": "Edit product",
    "add_to_canteen": "Add to the canteen",
    "product_name": "Product name",
    "stock_qty": "Stock quantity",
    "price_lbl": "Price ({cur})",
    "unlock_price": "🔒 Unlock with admin password",
    "price_unlocked": "🔓 Price unlocked",
    "product_image": "Product image",
    "tap_upload": "Tap to upload an image → Cloudinary",
    "image_uploaded": "Image uploaded.",
    "tap_replace": "Image uploaded — tap to replace",
    "upload_failed": "Upload failed.",
    "configure_cloudinary": "Configure Cloudinary in js/config.js first.",
    "save_changes": "Save changes",
    "add_product_btn": "Add product",
    "name_required": "Product name is required.",
    "invalid_price": "Invalid price.",
    "invalid_qty": "Invalid quantity (whole number ≥ 0).",
    "product_added": "Product added.",
    "changes_saved": "Changes saved.",
    "save_failed": "Save failed.",
    "unlock_price_first": "Unlock the price with the admin password to change it.",

    "delete_product_title": "Delete product",
    "delete_product_msg": "\"{name}\" will be hidden from the POS (soft delete — it stays in history). Continue?",
    "delete_reason": "Deleting a product requires the admin password.",
    "product_deleted": "Product deleted (soft delete).",
    "delete_failed": "Delete failed.",

    "refund_sale_title": "Refund sale",
    "refund_sale_msg": "Refund order no. {order} for {total}? Quantities return to stock and the action is logged.",
    "refund_reason_lbl": "Refund reason (optional)",
    "refund_reason_ph": "e.g. wrong order",
    "refund_done": "Refunded — stock restored.",
    "refund_failed": "Refund failed.",
    "already_refunded": "This sale has already been refunded.",
    "refund_needs_admin": "Refunding requires the admin password.",

    "daily_reports": "Daily closing reports",
    "close_day": "Close Day",
    "close_day_title": "Close the day",
    "close_day_intro": "Review today's numbers, then count the actual cash in the drawer.",
    "expected_cash": "Expected cash",
    "orders_today": "Orders",
    "actual_cash_lbl": "Actual cash ({cur})",
    "difference_lbl": "Difference",
    "notes_lbl": "Notes (optional)",
    "close_day_btn": "Close day & save report",
    "close_day_reason": "Closing the day requires the admin password.",
    "day_closed": "Day closed — report saved.",
    "day_already_closed": "This day has already been closed.",
    "close_day_failed": "Failed to close the day.",
    "invalid_cash": "Enter a valid cash amount.",
    "date": "Date",
    "orders_count": "Orders",
    "expected": "Expected",
    "actual": "Actual",
    "difference": "Difference",
    "closed_by": "Closed by",
    "notes": "Notes",
    "no_reports": "No closing reports yet.",

    "audit_log": "Audit log",
    "time": "Time",
    "user": "User",
    "action": "Action",
    "details": "Details",
    "no_logs": "No log entries yet.",
    "action_sale": "Sale",
    "action_refund": "Refund",
    "action_price_change": "Price change",
    "action_daily_close": "Daily close",
    "action_product_add": "Product added",
    "action_product_update": "Product updated",
    "action_product_delete": "Product deleted",
    "action_login": "Login",

    "dashboard_load_failed": "Failed to load dashboard data.",
    "err_insufficient_stock": "Not enough stock for \"{name}\" ({n} available).",
    "err_product_not_found": "A product is no longer available.",
    "err_empty_cart": "Cart is empty.",
    "err_invalid_admin": "Invalid admin password.",
    "err_generic": "Something went wrong. Please try again.",
    "migration_needed": "Database needs upgrading — run migration.sql then schema.sql."
  }
};

const I18N = {
  lang: 'ar',

  init() {
    let saved = null;
    try { saved = localStorage.getItem('canteen_lang'); } catch (_) {}
    this.lang = (saved && I18N_DICT[saved]) ? saved : 'ar';   // Arabic-first
    this.applyDir();
  },

  t(key, vars) {
    const dict = I18N_DICT[this.lang] || I18N_DICT.ar;
    let s = dict[key] ?? I18N_DICT.ar[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  },

  set(lang) {
    if (!I18N_DICT[lang] || lang === this.lang) return;
    this.lang = lang;
    try { localStorage.setItem('canteen_lang', lang); } catch (_) {}
    this.applyDir();
    this.apply();
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  },

  toggle() { this.set(this.lang === 'ar' ? 'en' : 'ar'); },

  applyDir() {
    const root = document.documentElement;
    root.lang = this.lang;
    root.dir = I18N_DICT[this.lang]._dir;
  },

  /* Stamp every data-i18n* element inside `root` (defaults to the page). */
  apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = this.t(n.dataset.i18n); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(n => { n.placeholder = this.t(n.dataset.i18nPlaceholder); });
    root.querySelectorAll('[data-i18n-aria]').forEach(n => { n.setAttribute('aria-label', this.t(n.dataset.i18nAria)); });
    root.querySelectorAll('[data-i18n-title]').forEach(n => { n.title = this.t(n.dataset.i18nTitle); });
  },
};

/* Global shorthand used across all page scripts. */
const t = (key, vars) => I18N.t(key, vars);

I18N.init();
