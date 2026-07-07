/* =============================================================================
 *  config.js  —  Fill these in with your own project values.
 * -----------------------------------------------------------------------------
 *  The Supabase ANON key and Cloudinary values are meant to be public: the
 *  database is protected by Row Level Security and Cloudinary by an unsigned
 *  upload preset. Do NOT put your Supabase *service_role* key here.
 *
 *  Passwords are stored as SHA-256 hashes, never plaintext. Generate a hash by
 *  opening the browser console on any page and running:
 *      await hashText('your-password-here')
 *  then paste the result below.
 *
 *  If you deploy with build-time env injection (see README), the build writes a
 *  `window.ENV` object that these lines automatically pick up.
 * ========================================================================== */

const ENV = (typeof window !== 'undefined' && window.ENV) ? window.ENV : {};

const CONFIG = {
  // ---- Supabase --------------------------------------------------------------
  SUPABASE_URL:      ENV.SUPABASE_URL      || 'https://zmomklqdnaonszqwkfwf.supabase.co',
  SUPABASE_ANON_KEY: ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptb21rbHFkbmFvbnN6cXdrZndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MjgxNzQsImV4cCI6MjA5OTAwNDE3NH0.BmcwL5mu5MUatm0wQBog4c5h_r8g3DqPcqraai0_Pzo',

  // ---- Cloudinary (unsigned upload) -----------------------------------------
  CLOUDINARY_CLOUD_NAME:    ENV.CLOUDINARY_CLOUD_NAME    || 's3cl66qq',
  CLOUDINARY_UPLOAD_PRESET: ENV.CLOUDINARY_UPLOAD_PRESET || 'FECA_Canteen',
  CLOUDINARY_FOLDER:        ENV.CLOUDINARY_FOLDER        || 'canteen-products',

  // ---- Access (SHA-256 hashes, not plaintext) -------------------------------
  // Defaults below are the hashes of the words "seller" and "admin".
  // CHANGE THESE before going live — see instructions above.
  SELLER_PASSWORD_HASH: ENV.SELLER_PASSWORD_HASH ||
    'dd847ad1c171a96b58b40b845630eac6aa719d6767e6659f41ee554ce8ccdf33', // "seller"
  ADMIN_PASSWORD_HASH:  ENV.ADMIN_PASSWORD_HASH ||
    'f986bf123367958876643b780d64b09a4046ba1de06fe3239b2db1f4993407f2', // "admin"

  // ---- Branding --------------------------------------------------------------
  CHURCH_NAME_AR: 'الكنيسة الإنجيلية الأولى في أسيوط',
  CHURCH_NAME_EN: 'First Evangelical Church — Assiut',
  SINCE: '١٨٧٠',
  SELLER_NAME: 'Canteen Seller',
  CURRENCY: 'EGP',
};

/* SHA-256 helper — exposed globally so you can generate hashes in the console. */
async function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
if (typeof window !== 'undefined') window.hashText = hashText;
