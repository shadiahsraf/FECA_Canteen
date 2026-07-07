/* build-env.js — runs on Vercel (buildCommand) to inject environment variables
 * into a static-safe js/env.js. Reads from process.env; anything missing is
 * simply omitted, and config.js falls back to its own defaults.
 *
 * Set these in Vercel → Project → Settings → Environment Variables:
 *   SUPABASE_URL, SUPABASE_ANON_KEY,
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_FOLDER,
 *   SELLER_PASSWORD_HASH, ADMIN_PASSWORD_HASH
 *
 * This is a build-time script, not a runtime server — the deployed site stays
 * fully static.
 */
const fs = require('fs');
const path = require('path');

const KEYS = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_UPLOAD_PRESET', 'CLOUDINARY_FOLDER',
  'SELLER_PASSWORD_HASH', 'ADMIN_PASSWORD_HASH',
];

const env = {};
for (const k of KEYS) if (process.env[k]) env[k] = process.env[k];

const out = `/* Generated at build time — do not edit. */\nwindow.ENV = ${JSON.stringify(env, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, 'js', 'env.js'), out);
console.log(`build-env: wrote js/env.js with ${Object.keys(env).length} variable(s).`);
