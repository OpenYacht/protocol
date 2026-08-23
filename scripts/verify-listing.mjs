// Node-directory listing verification (registry/nodes.json governance — see
// spec/federation-protocol.md §Finding partners and the walkthrough in
// registry/README.md). Verifies that a listing token was signed by a key the
// domain currently publishes, i.e. that the request really comes from the
// node's operator:
//   1. parse the token and bound its date (±30 days of now);
//   2. fetch https://{domain}/.well-known/openyacht LIVE — this is the one
//      script in this repo that touches the network, which is why it is not
//      part of `npm test` / the main-branch lint (a partner's outage must
//      never break CI); run it in PR review or locally;
//   3. try the Ed25519 signature against each currently-published key — no
//      key ID in the token, by design.
// Node >= 19 (webcrypto Ed25519); no dependencies.
//
// Usage: node scripts/verify-listing.mjs <token> <base64-signature>

const [token, signatureB64] = process.argv.slice(2);

const die = (msg) => { console.error(`FAIL  ${msg}`); process.exit(1); };

if (!token || !signatureB64) {
  die("usage: node scripts/verify-listing.mjs <token> <base64-signature>");
}

// --- 1. Parse and bound the token -----------------------------------------

const TOKEN = /^openyacht-node-listing:v1:([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+):(list|delist|amend):([0-9]{4}-[0-9]{2}-[0-9]{2})$/;
const m = TOKEN.exec(token);
if (!m) {
  die(`token does not match openyacht-node-listing:v1:{domain}:{action}:{date} ` +
    `(domain lowercase, no scheme/path/port; action list|delist|amend; date YYYY-MM-DD): ${token}`);
}
const [, domain, , , , action, date] = m;

const dateMs = Date.parse(`${date}T00:00:00Z`);
if (Number.isNaN(dateMs) || new Date(dateMs).toISOString().slice(0, 10) !== date) {
  die(`token date is not a real calendar date: ${date}`);
}
const skewDays = Math.abs(Date.now() - dateMs) / 86_400_000;
if (skewDays > 30) {
  die(`token date ${date} is outside ±30 days of now (${skewDays.toFixed(0)} days) — a fresh token must be produced`);
}

let signature;
try {
  signature = Buffer.from(signatureB64, "base64");
  if (signature.length !== 64) throw new Error(`decoded to ${signature.length} bytes, expected 64`);
} catch (e) {
  die(`signature is not a base64 Ed25519 signature: ${e.message}`);
}
if (signature.every((b) => b === 0)) die("signature is all zero bytes");

// --- 2. Fetch the domain's live well-known document ------------------------

const url = `https://${domain}/.well-known/openyacht`;
let doc;
try {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: "application/json" },
  });
  if (!res.ok) die(`${url} returned HTTP ${res.status}`);
  doc = await res.json();
} catch (e) {
  if (e instanceof SyntaxError) die(`${url} did not return valid JSON`);
  die(`could not fetch ${url}: ${e.cause?.message ?? e.message}`);
}
if (!Array.isArray(doc.keys) || doc.keys.length === 0) {
  die(`${url} has no keys array — not a valid well-known document`);
}

// --- 3. Try the signature against each currently-published key -------------

const tokenBytes = new TextEncoder().encode(token);
for (const key of doc.keys) {
  if (key?.algorithm !== "ed25519" || typeof key.public_key !== "string") continue;
  let raw;
  try {
    raw = Buffer.from(key.public_key, "base64");
    // A degenerate (all-zero) key is a small-order point some verifiers accept
    // any zero signature against; no honest node ever publishes one.
    if (raw.length !== 32 || raw.every((b) => b === 0)) continue;
  } catch { continue; }
  try {
    const publicKey = await crypto.subtle.importKey("raw", raw, "Ed25519", false, ["verify"]);
    if (await crypto.subtle.verify("Ed25519", publicKey, signature, tokenBytes)) {
      console.log(`ok    ${action} request for ${domain} verified against published key ${key.key_id ?? "(no key_id)"} (token dated ${date})`);
      process.exit(0);
    }
  } catch { continue; }
}

die(`signature does not verify against any key currently published at ${url} — ` +
  `either the token/signature was mangled in transit (check for wrapped lines) or it was not signed by this node's current key`);
