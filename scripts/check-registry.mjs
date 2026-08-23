// Registry well-formedness: builders.json, categories.json, destinations.json
// and features.json (unique, well-formatted slugs; version and canonical URL;
// allowed keys), plus a cross-check that every non-null builder/category/
// destination slug in examples/valid/ exists in its registry — the schemas
// deliberately don't encode registry membership, so this is where that
// consistency is enforced for the examples we publish. Feature slugs are
// cross-checked too, but only WARN: features.json is a non-normative
// well-known list, never a validation gate.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
const fail = (msg) => { console.error(`FAIL  ${msg}`); failures++; };
const warn = (msg) => { console.warn(`WARN  ${msg}`); };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkRegistry(file, { registryName, entriesKey, allowedKeys, uniqueNames }) {
  const reg = JSON.parse(readFileSync(join(root, "registry", file), "utf8"));
  if (reg.registry !== registryName) fail(`${file}: registry name ${reg.registry}`);
  if (!/^[0-9]{4}\.[0-9]{2}\.[0-9]+$/.test(reg.version)) fail(`${file}: version not date-based (yyyy.mm.n): ${reg.version}`);
  if (reg.canonical_url !== `https://openyacht.org/registry/${file}`) fail(`${file}: canonical_url ${reg.canonical_url}`);
  const entries = reg[entriesKey];
  if (!Array.isArray(entries) || entries.length === 0) { fail(`${file}: ${entriesKey} is not a non-empty array`); return new Set(); }

  const slugs = new Set(), names = new Set();
  for (const e of entries) {
    if (typeof e.slug !== "string" || !SLUG.test(e.slug)) fail(`${file}: bad slug ${JSON.stringify(e.slug)}`);
    if (slugs.has(e.slug)) fail(`${file}: duplicate slug ${e.slug}`);
    slugs.add(e.slug);
    if (typeof e.name !== "string" || e.name.trim() === "") fail(`${file}: entry ${e.slug}: empty name`);
    if (uniqueNames) {
      if (names.has(e.name)) fail(`${file}: duplicate name "${e.name}" (${e.slug}) — display names must be unique, consumers fall back to them`);
      names.add(e.name);
    }
    const extra = Object.keys(e).filter((k) => !allowedKeys.includes(k));
    if (extra.length) fail(`${file}: entry ${e.slug}: unexpected keys ${extra.join(", ")}`);
  }
  console.log(`ok    registry/${file}: ${entries.length} entries, version ${reg.version}, slugs unique`);
  return slugs;
}

const builderSlugs = checkRegistry("builders.json", {
  registryName: "openyacht-builders",
  entriesKey: "builders",
  allowedKeys: ["slug", "name", "country"],
  uniqueNames: false, // suffix pairs are sometimes genuinely different companies
});
const categorySlugs = checkRegistry("categories.json", {
  registryName: "openyacht-categories",
  entriesKey: "categories",
  allowedKeys: ["slug", "name"],
  uniqueNames: true,
});

const destinations = JSON.parse(readFileSync(join(root, "registry", "destinations.json"), "utf8"));
const destinationSlugs = checkRegistry("destinations.json", {
  registryName: "openyacht-destinations",
  entriesKey: "destinations",
  allowedKeys: ["slug", "name", "parent"],
  uniqueNames: true, // hierarchy is resolved via parent, never by reading the name
});
// Hierarchy integrity: every parent resolves, nothing is its own ancestor.
const parentOf = new Map(destinations.destinations.map((e) => [e.slug, e.parent ?? null]));
for (const [slug, parent] of parentOf) {
  if (parent === null) continue;
  if (!parentOf.has(parent)) { fail(`destinations.json: ${slug}: parent "${parent}" is not an entry`); continue; }
  const seen = new Set([slug]);
  for (let p = parent; p != null; p = parentOf.get(p)) {
    if (seen.has(p)) { fail(`destinations.json: ${slug}: parent chain is cyclic at "${p}"`); break; }
    seen.add(p);
  }
}
const ancestorsOf = (slug) => {
  const out = new Set();
  for (let p = parentOf.get(slug); p != null; p = parentOf.get(p)) out.add(p);
  return out;
};
console.log(`ok    registry/destinations.json: hierarchy resolves, no cycles`);

// features.json is non-normative (never a validation gate), but its structure
// is linted exactly like the fixed registries.
const features = JSON.parse(readFileSync(join(root, "registry", "features.json"), "utf8"));
const featureSlugs = checkRegistry("features.json", {
  registryName: "openyacht-features",
  entriesKey: "features",
  allowedKeys: ["slug", "name", "category"],
  uniqueNames: true, // consumers fall back to the name when a slug is unknown
});
// The category is the registry's own grouping label, not an enum — but it is
// still a label we publish, so it must be slug-formatted and present.
for (const e of features.features) {
  if (typeof e.category !== "string" || !SLUG.test(e.category)) fail(`features.json: entry ${e.slug}: bad category ${JSON.stringify(e.category)}`);
}

// Cross-check: example listings only reference registered slugs.
for (const file of readdirSync(join(root, "examples/valid")).sort()) {
  const data = JSON.parse(readFileSync(join(root, "examples/valid", file), "utf8"));
  if (!data.vessel && !data.specifications) continue; // not a listing payload
  const b = data.vessel?.builder?.slug;
  if (b != null && !builderSlugs.has(b)) fail(`examples/valid/${file}: builder slug "${b}" not in registry/builders.json`);
  const c = data.specifications?.category?.slug;
  if (c != null && !categorySlugs.has(c)) fail(`examples/valid/${file}: category slug "${c}" not in registry/categories.json`);
  const areas = (data.charter?.operating_areas ?? []).map((a) => a?.slug).filter((s) => s != null);
  for (const a of areas) {
    if (!destinationSlugs.has(a)) fail(`examples/valid/${file}: destination slug "${a}" not in registry/destinations.json`);
  }
  // The spec forbids sending a parent alongside its own descendants: the parent already implies them.
  for (const a of areas) {
    for (const anc of ancestorsOf(a)) {
      if (areas.includes(anc)) fail(`examples/valid/${file}: operating_areas lists "${a}" and its ancestor "${anc}" — the parent already implies it`);
    }
  }
  // Feature slugs: warn only — features.json is a non-normative well-known
  // list, and an unlisted slug on the wire is a curation prompt, not an error.
  for (const f of data.features ?? []) {
    if (f?.slug != null && !featureSlugs.has(f.slug)) warn(`examples/valid/${file}: feature slug "${f.slug}" not in registry/features.json (non-normative list — warning only)`);
  }
}
console.log("ok    examples/valid: all builder/category/destination slugs exist in their registries");

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
