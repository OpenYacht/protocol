// Validate every file in examples/valid/ against its schema, and require
// every file in examples/invalid/ to FAIL — a passing invalid example fails
// the build (each invalid file carries exactly one deliberate defect).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_BASE = "https://openyacht.org/schemas/v1/";

const ajv = new Ajv2020.default({ strict: true, allErrors: true });
addFormats.default(ajv);

for (const file of readdirSync(join(root, "schemas/v1"))) {
  ajv.addSchema(JSON.parse(readFileSync(join(root, "schemas/v1", file), "utf8")));
}

// filename → schema. Valid examples must be mapped explicitly; invalid
// examples are listing payloads unless mapped here.
const validMap = {
  "sale-full.json": "listing.schema.json",
  "charter-full.json": "listing.schema.json",
  "tombstone.json": "tombstone.schema.json",
  "collection-page.json": "collection.schema.json",
  "well-known.json": "well-known.schema.json",
  "capabilities.json": "capabilities.schema.json",
  "error.json": "error.schema.json",
};
const invalidMap = {}; // defaults to listing.schema.json

let failures = 0;
const fail = (msg) => { console.error(`FAIL  ${msg}`); failures++; };

for (const file of readdirSync(join(root, "examples/valid")).sort()) {
  const schemaFile = validMap[file];
  if (!schemaFile) { fail(`${file}: no schema mapping in scripts/validate-examples.mjs`); continue; }
  const validate = ajv.getSchema(SCHEMA_BASE + schemaFile);
  const data = JSON.parse(readFileSync(join(root, "examples/valid", file), "utf8"));
  if (validate(data)) {
    console.log(`ok    valid/${file} → ${schemaFile}`);
  } else {
    fail(`valid/${file} does not validate against ${schemaFile}:`);
    for (const e of validate.errors) console.error(`      ${e.instancePath || "/"} ${e.message}`);
  }
}

for (const file of readdirSync(join(root, "examples/invalid")).sort()) {
  const schemaFile = invalidMap[file] ?? "listing.schema.json";
  const validate = ajv.getSchema(SCHEMA_BASE + schemaFile);
  const data = JSON.parse(readFileSync(join(root, "examples/invalid", file), "utf8"));
  if (validate(data)) {
    fail(`invalid/${file} VALIDATES against ${schemaFile} — its deliberate defect is not being caught`);
  } else {
    console.log(`ok    invalid/${file} fails ${schemaFile} as intended`);
  }
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\nAll examples behave as intended.");
