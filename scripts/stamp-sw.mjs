// Runs on every Vercel build: stamps sw.js with a unique build id so each deploy
// gets a fresh cache and installed PWAs show the "Update available" prompt.
import { readFileSync, writeFileSync } from 'node:fs';

const build = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 8);
const file = new URL('../sw.js', import.meta.url);
const src = readFileSync(file, 'utf8');

if (!/const BUILD = '[^']*';/.test(src)) {
  console.error('stamp-sw: could not find the BUILD constant in sw.js');
  process.exit(1);
}
writeFileSync(file, src.replace(/const BUILD = '[^']*';/, `const BUILD = '${build}';`));
console.log(`stamp-sw: BUILD = ${build}`);
