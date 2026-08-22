// Markdown link check across the repository:
//  1. tripwire — no reference (link or inline path) may point at a
//     private-repo path; this is also the safety net for curation misses;
//  2. every relative markdown link resolves to a file in this repository.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const mdFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".git", ".github"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".md")) mdFiles.push(p);
  }
})(root);

// Paths that only exist in the private repository.
const PRIVATE = [
  /\.\.\/reference\//, /\.\.\/responses\//,
  /docs\/reference\//, /docs\/responses\//, /docs\/business\//,
  /docs\/implementation\//, /docs\/website\//, /docs\/outreach\//,
  /\.\.\/open-questions\.md/, /\.\.\/project-overview\.md/, /\.\.\/landscape-2026\.md/,
];

let failures = 0;
const fail = (msg) => { console.error(`FAIL  ${msg}`); failures++; };

for (const file of mdFiles) {
  const rel = file.slice(root.length + 1);
  const text = readFileSync(file, "utf8");

  for (const re of PRIVATE) {
    if (re.test(text)) fail(`${rel}: references private-repo path (${re})`);
  }

  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = resolve(dirname(file), target.split("#")[0]);
    if (!existsSync(path)) fail(`${rel}: broken relative link → ${target}`);
  }
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log(`ok    ${mdFiles.length} markdown files: no private-repo paths, all relative links resolve`);
