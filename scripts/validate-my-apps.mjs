// Validates data/my-apps.json before every deploy (runs from vercel.json's buildCommand).
//   node scripts/validate-my-apps.mjs
// Fails (exit 1) on malformed entries, unknown platforms/statuses, or an "available" app without a valid https download URL.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLATFORMS = ['android', 'ios', 'windows', 'linux'];
const STATUSES = ['available', 'coming-soon', 'not-released'];
const problems = [];
const bad = (m) => problems.push(m);
const str = (v) => typeof v === 'string' && v.trim().length > 0;

let data;
try { data = JSON.parse(readFileSync(join(root, 'data/my-apps.json'), 'utf8')); }
catch (e) { console.error('data/my-apps.json is not valid JSON:', e.message); process.exit(1); }

const sw = readFileSync(join(root, 'sw.js'), 'utf8');
if (!Array.isArray(data.apps)) bad('"apps" must be an array');
const ids = new Set();

(data.apps || []).forEach((a, i) => {
  const at = `apps[${i}]${a && a.id ? ` (${a.id})` : ''}`;
  if (!a || typeof a !== 'object') return bad(`${at}: not an object`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(a.id || '')) bad(`${at}: "id" must be lowercase letters, digits and dashes`);
  if (ids.has(a.id)) bad(`${at}: duplicate id`);
  ids.add(a.id);
  ['name', 'description', 'category'].forEach((k) => { if (!str(a[k])) bad(`${at}: "${k}" is required`); });
  if (!PLATFORMS.includes(a.platform)) bad(`${at}: "platform" must be one of ${PLATFORMS.join(', ')}`);
  if (!STATUSES.includes(a.status)) bad(`${at}: "status" must be one of ${STATUSES.join(', ')}`);
  if (a.releaseDate != null && (!/^\d{4}-\d{2}-\d{2}$/.test(a.releaseDate) || isNaN(Date.parse(a.releaseDate)))) bad(`${at}: "releaseDate" must be YYYY-MM-DD or null`);
  if (a.changelog != null && !Array.isArray(a.changelog)) bad(`${at}: "changelog" must be an array`);
  if (a.requirements != null && !Array.isArray(a.requirements) && typeof a.requirements !== 'object') bad(`${at}: "requirements" must be an array`);
  if (str(a.downloadUrl)) {
    let u = null;
    try { u = new URL(a.downloadUrl); } catch (e) { /* handled below */ }
    if (!u || u.protocol !== 'https:' || !u.hostname.includes('.')) bad(`${at}: "downloadUrl" must be a full https:// URL`);
    else if (/^(www\.)?example\.(com|org|net)$/i.test(u.hostname)) bad(`${at}: "downloadUrl" is a placeholder`);
  } else if (a.status === 'available') {
    bad(`${at}: status is "available" but "downloadUrl" is empty (use "coming-soon" until the file is uploaded)`);
  }
  if (/^(\.{0,2}\/|assets\/|data\/)/.test(a.icon || '') && !/^https?:/i.test(a.icon) && !existsSync(join(root, a.icon.replace(/^\//, '')))) bad(`${at}: icon file "${a.icon}" does not exist`);
});

for (const f of ['data/my-apps.json', 'assets/js/myapps.js', 'assets/css/myapps.css']) {
  if (!sw.includes(`'${f}'`)) bad(`sw.js PRECACHE must include '${f}'`);
}

if (problems.length) {
  console.error('My Apps validation failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log(`My Apps OK: ${data.apps.length} app(s).`);
