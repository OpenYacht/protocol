# OpenYacht Federation Protocol

**Status**: Draft v0.1 (2026-08).
**Audience**: Anyone implementing an OpenYacht node — the reference implementation, or an existing in-house system adding a federation endpoint.

## Overview

OpenYacht federation is server-to-server sharing of yacht listings between brokerages, with no central operator. Each participating system ("node") is identified by its domain, publishes its public key and endpoints at a well-known URL, and signs every federation request with its private key. Trust is established directly between brokerages, pairwise — there is no registry that can charge for access, because there is nothing in the middle.

Design goals, in order:

1. **Simple enough to implement in days** — an existing in-house system should be able to add a compliant endpoint without adopting any framework or library beyond an Ed25519 implementation and an HTTP client.
2. **No coordination requirements** — key rotation, recovery, and discovery all work without contacting anyone.
3. **Explicit trust** — nothing is shared with a partner a human has not approved.

## Identity and Trust Model

A node's identity is its **domain**. This is a deliberate choice with consequences that implementers must understand:

- Verifying a signature means fetching keys from `https://{domain}/.well-known/openyacht` over TLS. The security of the system therefore reduces to control of the domain (DNS + TLS). This is the same trust anchor as ActivityPub and email (DKIM), and it is appropriate here: a brokerage's domain is already its business identity.
- Trust on first use (TOFU): the first time a node fetches a partner's keys, it trusts what the domain serves. Anyone who takes over a partner's domain or server can silently rotate that partner's identity. For this reason, partner relationships carry **trust levels**, and high-trust partners SHOULD additionally **pin** each other's keys out of band (a phone call comparing key fingerprints is sufficient).
- Each installation also has a **node UUID**, generated at install time. The UUID is *not* a trust anchor; it exists to detect that a domain now hosts a different installation (reinstall, migration, or takeover), which MUST downgrade the partner to `provisional` pending human re-approval.

### Choosing the identity domain

The identity domain may be **any hostname the brokerage controls — subdomains explicitly included**. It SHOULD be chosen under the domain partners already know the business by, because the trust model leans on a human recognising it at approval time: `openyacht.example-brokerage.com` is instantly attributable; an internal or unrelated hostname is not.

Choose it once and deliberately — the choice is permanent in practice. The identity domain carries the whole node: the well-known trust root, the API base path, the host line of every request signature, and every canonical listing URI (`yacht-identity.md`), which never changes for the life of a listing.

- **Recommended pattern**: a dedicated subdomain of the recognisable business domain (`openyacht.{business-domain}`), DNS-pointed at whatever server runs the node. This needs no special protocol support — control of a subdomain is proven by the same DNS + TLS mechanics as the apex — and it keeps the node portable: it can move to a different server or codebase by repointing DNS, with identity, keys, and canonical URIs surviving the move. Serving directly on an apex occupied by separate marketing-site hosting is possible but couples federation availability to an unrelated stack.
- A node reachable under multiple hostnames (in-house systems usually are) SHOULD serve the federation endpoints **only** on its identity domain and refuse them on every other host, so its identity cannot fork.
- **Endpoint delegation to a different origin** (the well-known document naming absolute URLs elsewhere, WebFinger-style) is **out of scope for v1**: subdomains cover every identified case without complicating the signing-string host or canonical-URI rules. If a future version adopts delegation, it must define both.

### Trust levels

| Level | Meaning | Granted by |
|---|---|---|
| `verified` | Established business relationship, human-approved | Administrator action |
| `provisional` | Known but unapproved; limited or no data shared | Automatic on first contact |
| `blocked` | Explicitly refused; all requests rejected | Administrator action |

## Keys

- **Algorithm**: Ed25519 (RFC 8032). Chosen over RSA for small keys, fast verification, and no parameter/padding foot-guns. The signature envelope carries an `algorithm` field so future algorithms (including post-quantum) can be added by protocol minor version.
- **Generation**: an Ed25519 keypair is generated at installation. The private key is stored encrypted at rest and MUST be included in encrypted backups — losing it is recoverable (see Rotation) but disruptive.
- **Key ID**: the first 16 hex characters of the SHA-256 hash of the raw 32-byte public key. Used in headers to select which published key to verify against.

### Storage schema (reference)

```sql
federation_keys (
  id            PRIMARY KEY,
  key_id        VARCHAR(16) UNIQUE,   -- fingerprint prefix, see above
  private_key   TEXT,                 -- encrypted at rest
  public_key    TEXT,                 -- base64, raw 32 bytes
  status        ENUM('active','retiring','revoked'),
  created_at    TIMESTAMP,
  retired_at    TIMESTAMP NULL
)
```

## Discovery: the well-known endpoint

Every node serves:

```
GET https://{domain}/.well-known/openyacht
```

```json
{
  "openyacht": "1.0",
  "protocol_versions": ["1.0"],
  "node": {
    "uuid": "018f3c2e-…",
    "name": "Example Yacht Brokerage",
    "software": "openyacht-reference/1.0",
    "website": "https://example-brokerage.com"
  },
  "keys": [
    {
      "key_id": "a1b2c3d4e5f60718",
      "algorithm": "ed25519",
      "public_key": "base64-of-raw-32-bytes",
      "created_at": "2026-08-20T10:30:00Z"
    }
  ],
  "endpoints": {
    "listings": "/openyacht/v1/listings",
    "partners": "/openyacht/v1/partners",
    "subscriptions": "/openyacht/v1/subscriptions",
    "health": "/openyacht/v1/health",
    "capabilities": "/openyacht/v1/capabilities"
  },
  "generated_at": "2026-08-20T10:30:00Z"
}
```

Rules:

- MUST be served over HTTPS with a valid certificate; verifiers MUST NOT accept plain HTTP or invalid TLS.
- `keys` is an array so that rotation can overlap (see below). Verifiers try the key matching the request's key ID.
- Responses SHOULD be cached by consumers for 24 hours, keyed by domain.
- Nodes SHOULD rate-limit this endpoint per requesting IP (it is public and unauthenticated); 1 request/minute/consumer is ample given caching.

## Finding partners: the node directory

*(Added by amendment, 2026-08: the first stage of the discovery layer the v0.1 scope deferred, shipped as out-of-band advisory data. Nothing on the wire changes, and design goal 2 holds — discovery still works without contacting anyone, because the directory is optional.)*

The project publishes a **node directory** — an optional, advisory seed list of nodes that have asked to be listed — at `https://openyacht.org/registry/nodes.json`, versioned and vendored like the shared vocabulary registries (see [`../registry/README.md`](../registry/README.md)). The directory is a phonebook, not a membership list: it lists nodes that asked to be listed; being in it grants nothing; being absent from it costs nothing; and everything a partner needs to verify comes from the node's own domain, never from the directory.

Three rules are normative:

1. **Listing is opt-in and advisory.** A node MUST NOT require a prospective partner to appear in the directory, and MUST NOT treat absence from it as a signal about anything.
2. **Presence conveys existence only.** Consumers MUST NOT treat a directory entry as endorsement, identity verification, or trust. A node found via the directory is verified exactly like a domain learned any other way: fetch its well-known document over TLS, trust on first use, pairwise human approval. On any conflict between a directory entry and the node's own documents, the node's documents win.
3. **The directory is out-of-band data.** Consumers vendor a copy and refresh it out of band; nothing on the wire — signing, verification, sync — depends on it or references it.

An entry carries display metadata only — no keys, no endpoints, nothing verifiable, nothing trust-bearing:

| Field | Rule |
|---|---|
| `domain` | The node's **identity domain** (see above) — lowercase, no scheme, no path, no port. Unique; the primary key. Everything else about the node is dereferenced live from it. |
| `name` | Human display label; should match the well-known `node.name` at listing time. The live document wins on drift. |
| `website` | `https://` URL of the brokerage's public site (usually not the identity domain). |
| `country` | ISO 3166-1 alpha-2 — the country of the brokerage's principal office. |
| `listed_at` | `YYYY-MM-DD` the entry was added. |

### The listing token

Listing, delisting, and amending an entry happen only by **signed request from the node operator**: the same Ed25519 key that signs federation requests proves listing consent, so nobody can list — or delist — a domain they do not control. The request carries two lines:

```
token:     openyacht-node-listing:v1:{domain}:{action}:{date}
signature: <base64 Ed25519 signature over the UTF-8 token>
```

- `action` is `list`, `delist`, or `amend`.
- `date` is `YYYY-MM-DD` and the token is valid within ±30 days of verification, so an old captured `list` token cannot be replayed to re-list a node that has since delisted.
- The signature MUST verify against a key **currently published** in the domain's live `/.well-known/openyacht`, fetched at verification time. There is deliberately no key-ID line: the verifier simply tries each currently-published key (a handful at most during rotation overlap; Ed25519 verification is cheap), so a hand-copied key ID cannot become a failure mode.

**Lost keys**: a node that has lost its keys entirely can be **delisted** — never listed — on maintainer judgement with out-of-band verification. Being unable to remove a dead entry is worse than the spoof risk on removal, and a spoofed delisting is self-correcting: the operator re-lists with a fresh signature.

How to submit a listing request (issue form or pull request) is operator documentation, not protocol — see the walkthrough in [`../registry/README.md`](../registry/README.md).

## Request Signing

Every federation request (everything under `/openyacht/v1/` except `health` and `capabilities`) carries these headers:

```
X-OpenYacht-Node: sender-domain.com
X-OpenYacht-Key: a1b2c3d4e5f60718
X-OpenYacht-Timestamp: 2026-08-20T10:30:00Z
X-OpenYacht-Signature: base64-ed25519-signature
```

The **signing string** is the UTF-8 concatenation, separated by single `\n` characters, of:

```
uppercase HTTP method
request path including query string (e.g. /openyacht/v1/listings?updated_since=…)
lowercase host of the receiving node
value of X-OpenYacht-Timestamp
lowercase hex SHA-256 of the raw request body (for bodyless requests, the hash of the empty string)
```

The signature is Ed25519 over the signing string, base64-encoded.

### Verification procedure (receiving node)

1. Reject if `X-OpenYacht-Timestamp` is outside ±300 seconds of server time (replay protection). Receivers SHOULD also reject an exact duplicate (node, timestamp, signature) tuple seen within the window.
2. Reject if `X-OpenYacht-Node` is a blocked partner.
3. Look up cached keys for the sender domain; select by `X-OpenYacht-Key`.
4. Rebuild the signing string from the received request and verify the signature.
5. **On failure**: fetch the sender's well-known endpoint fresh (bypassing cache, respecting the rate limit), and retry verification once. If it now succeeds, update the cached keys. If it still fails, reject with `401` and log.
6. If the well-known document's node UUID differs from the stored UUID for that domain, downgrade the partner to `provisional`, reject the request, and notify administrators.

Step 5 is what makes rotation coordination-free; step 6 is what stops a reinstalled or hijacked domain from silently inheriting an approved relationship.

## Key Rotation

**Routine rotation** (no coordination, no outage):

1. Generate a new keypair; publish it in `keys` *alongside* the old key.
2. Start signing with the new key (its key ID in `X-OpenYacht-Key` tells verifiers which to use; their cache refresh or failure-triggered refetch picks it up).
3. After an overlap period (RECOMMENDED: 48 hours), remove the old key from the well-known document and mark it `revoked` locally.

**Emergency rotation** (suspected compromise): replace the key immediately without overlap. Partners' next verification fails, triggers a refetch, and recovers automatically. Document the incident.

**Total key loss** (no backup): generate a new keypair as in an emergency rotation. Because identity is the domain, no partner coordination is required — but if the node UUID also changed (full reinstall), partners will downgrade the relationship per verification step 6, which is the correct, safe behaviour.

## Partner Lifecycle

1. **Request**: node A signs `POST /openyacht/v1/partners/request` to node B with its domain and a contact message. B verifies the signature (which entails fetching A's well-known document), stores A as `provisional`, and notifies its administrators.
2. **Approval**: a human at B reviews and approves. B records A as `verified` and MAY send a signed reciprocal request to A.
3. **Sharing**: what A can see of B's inventory is governed entirely by B's sharing rules (see `yacht-identity.md` and `api-design.md`). Verification of the *business* (is this really Example Brokerage?) is a human judgement, optionally aided by out-of-band key pinning; the protocol authenticates the *server*, not the company.

**Approval is per partner, not per listing.** The human decision in step 2 is the only approval the protocol requires before data flows; this specification has no per-listing acceptance step — no point at which a person accepts or rejects an individual listing before it may be stored or displayed. Once a partner is `verified`, its listings synchronise automatically — and `yacht-identity.md` *requires* updates and withdrawals to be applied within 24 hours, an obligation a manual review queue standing in front of changes cannot reliably meet. Whether a synchronised copy is *displayed*, and under what policy, is a separate and entirely local decision (see `api-design.md` *Implementation Notes*). Exceptions that always reach a person include an unresolved vessel-identity conflict (`yacht-identity.md`) and a partner whose node UUID or unpinned key has changed. *(Clarified after implementer feedback, 2026-08: integrators read "human-approved" as a per-listing gate and concluded the protocol would not scale.)*

### Partner record (reference)

```sql
federation_partners (
  id                    PRIMARY KEY,
  domain                VARCHAR(255) UNIQUE,
  node_uuid             VARCHAR(36),
  keys_json             JSON,          -- cached well-known keys
  keys_fetched_at       TIMESTAMP,
  pinned_key_id         VARCHAR(16) NULL,  -- out-of-band pin, optional
  trust_level           ENUM('verified','provisional','blocked'),
  approved_by_user_id   BIGINT NULL,
  last_ok_at            TIMESTAMP NULL,
  consecutive_failures  INT DEFAULT 0,
  created_at            TIMESTAMP
)
```

If `pinned_key_id` is set, keys other than the pinned one are only accepted after administrator confirmation, even if the well-known document serves them. Pinning trades the coordination-free rotation property for stronger security; it is RECOMMENDED between high-value partners.

## Health and Failure Handling

- `GET /openyacht/v1/health` (unsigned) returns `{"status":"ok","time":"…"}` — used for liveness checks only.
- Consumers track `consecutive_failures` per partner and back off exponentially (RECOMMENDED cap: 24 h between attempts).
- Listings received from a partner that has been unreachable beyond a staleness threshold (RECOMMENDED: 7 days) MUST be flagged as stale in any consuming UI, and SHOULD be hidden from public display after 30 days. Stale data presented as fresh is precisely the failure mode of the scraping aggregators this protocol exists to replace; compliant implementations do not reproduce it.

## Versioning

The protocol uses semantic versioning, negotiated via `protocol_versions` in the well-known document and the `/capabilities` endpoint (see `api-design.md`). Breaking changes increment the major version and a node MAY serve multiple majors side by side (`/openyacht/v1/`, `/openyacht/v2/`). Additive changes (new optional fields, new endpoints) increment the minor version; consumers MUST ignore unknown fields.

## Security Checklist for Implementers

- Never log private keys or full signatures at debug level in production.
- Encrypt the private key at rest; include it in encrypted backups only.
- Enforce the timestamp window and the TLS requirements without exceptions.
- Rate-limit all federation endpoints per partner; block partners with sustained verification failure rates.
- Treat all inbound listing content (descriptions, image URLs, names) as untrusted input: sanitise HTML, validate URLs against the sender's claimed domains, and never hotlink images into admin interfaces without a content-type check.

