// Validates data/snippets.json before every deploy (runs from vercel.json's buildCommand).
//   node scripts/validate-snippets.mjs
// Fails (exit 1) on a malformed entry, a missing code file, or a code file the service worker would not cache offline.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const bad = (m) => problems.push(m);

let data;
try { data = JSON.parse(readFileSync(join(root, 'data/snippets.json'), 'utf8')); }
catch (e) { console.error('data/snippets.json is not valid JSON:', e.message); process.exit(1); }

const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const boards = data.boards || {};
const ids = new Set();
const str = (v) => typeof v === 'string' && v.trim().length > 0;

if (!Array.isArray(data.snippets) || !data.snippets.length) bad('"snippets" must be a non-empty array');

(data.snippets || []).forEach((s, i) => {
  const at = `snippets[${i}]${s && s.id ? ` (${s.id})` : ''}`;
  if (!s || typeof s !== 'object') return bad(`${at}: not an object`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id || '')) bad(`${at}: "id" must be lowercase letters, digits and dashes`);
  if (ids.has(s.id)) bad(`${at}: duplicate id`);
  ids.add(s.id);
  ['title', 'summary', 'filename'].forEach((k) => { if (!str(s[k])) bad(`${at}: "${k}" is required`); });
  if (!Array.isArray(s.boards) || !s.boards.length) bad(`${at}: "boards" must be a non-empty array`);
  (s.boards || []).forEach((b) => { if (!(b in boards)) bad(`${at}: unknown board "${b}" (add it to "boards")`); });
  if (!Array.isArray(s.tags)) bad(`${at}: "tags" must be an array`);
  if (!s.code && !s.codeFile) bad(`${at}: provide "code" (string or array of lines) or "codeFile"`);
  if (s.codeFile) {
    if (!existsSync(join(root, s.codeFile))) bad(`${at}: codeFile "${s.codeFile}" does not exist`);
    else if (!sw.includes(`'${s.codeFile}'`)) bad(`${at}: add '${s.codeFile}' to PRECACHE in sw.js so it works offline`);
  }
  (s.libraries || []).forEach((l, j) => { if (!str(l.name)) bad(`${at}: libraries[${j}].name is required`); });
  (s.wiring || []).forEach((w, j) => { if (!str(w.from) || !str(w.to)) bad(`${at}: wiring[${j}] needs "from" and "to"`); });
});

if (!sw.includes("'data/snippets.json'")) bad("sw.js PRECACHE must include 'data/snippets.json'");

if (problems.length) {
  console.error('Snippet validation failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log(`Snippets OK: ${data.snippets.length} snippet(s), ${Object.keys(boards).length} board(s).`);
