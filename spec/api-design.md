# Federation API

**Status**: Draft v0.1 (2026-08). The internal/website API of any node is deliberately out of scope: it is an implementation detail of each system, not part of the protocol.
**Prerequisites**: `federation-protocol.md` (signing, discovery, trust), `yacht-identity.md` (canonical URIs, authority, usage terms).

## Conventions

- Base path: `/openyacht/v1/` on the node's identity domain. All endpoints except `health` and `capabilities` require a valid federation signature.
- All bodies are JSON, UTF-8. Timestamps are RFC 3339 UTC. Monetary amounts are strings of decimal digits with `.` separator plus an ISO 4217 currency code — never floats.
- Consumers MUST ignore unknown fields (this is how minor versions stay compatible).
- Responses to a given partner contain only what that partner's sharing rules allow; filtering happens server-side at the authority.

## Endpoints

### Capabilities

```
GET /openyacht/v1/capabilities        (unsigned)
```

```json
{
  "protocol_versions": ["1.0"],
  "features": {
    "subscriptions": true,
    "charter_listings": true,
    "media_hashes": true
  },
  "limits": {
    "page_size_max": 100,
    "rate_per_hour": 500
  }
}
```

Feature names are the negotiation mechanism: a consumer checks for a feature before using it and degrades gracefully when absent.

The `features` object lists *optional* protocol features only — absence of a flag means a capability is part of the mandatory baseline, which is why there is no `sale_listings` flag: the sale-listing schema and `updated_since` sync are what every conforming node provides. `charter_listings` governs whether the node implements the charter block of the wire schema, not what inventory it holds. Inventory composition is never a conformance matter: an authority with no inventory of a given type conformantly serves zero listings of that type. A charter-only brokerage is a first-class node — it advertises `charter_listings: true` and simply never emits a `type: "sale"` listing. *(Clarified after Phase 1 implementer feedback, 2026-08.)*

### Listings

```
GET /openyacht/v1/listings?updated_since={ts}&cursor={c}&page_size={n}
GET /openyacht/v1/listings/{uuid}
```

- `updated_since` returns listings whose federation-visible state changed at or after the timestamp — **including** listings that became invisible to this partner (withdrawn, sold, or unshared), which appear as tombstones. This is what makes polling correct: a consumer that polls with its last sync time never misses a removal.
- Pagination is opaque-cursor based (`meta.next_cursor`, absent on the last page). Offset pagination is not used (it skips or duplicates rows under concurrent writes).
- The single-listing endpoint is the dereference target for canonical URIs.

Response envelope:

```json
{
  "data": [ { …listing… }, { …tombstone… } ],
  "meta": {
    "next_cursor": "opaque-string-or-absent",
    "generated_at": "2026-08-20T10:30:00Z",
    "protocol_version": "1.0"
  }
}
```

### Listing payload

The complete field-by-field wire schema is defined in `listing-schema.md` (Draft v0.1 — designed against the field models of working in-house brokerage systems rather than in the abstract). The structural contract, which is stable, is:

```json
{
  "id": "https://authority.example/openyacht/v1/listings/018f…",
  "type": "sale",
  "status": "active",
  "updated_at": "2026-08-19T16:05:00Z",
  "vessel": { … },
  "listing": {
    "name": "OASIS",
    "price": { "amount": "8500000", "currency": "EUR", "on_application": false, "starting_price": false },
    "location": { "display": "Palma de Mallorca, Spain", "city": "Palma de Mallorca", "state": null, "country": "ES", "marina": null, "coordinates": null },
    "brokers": [ { "name": "…", "email": "…" } ]
  },
  "specifications": { … },
  "descriptions": [ { "section": "overview", "content": "…" } ],
  "features": [ … ],
  "media": { "profile": { "url": "…", "sha256": "…", … }, "gallery": [ … ], "layouts": [ … ], "videos": [ … ], "tours": [ … ], "documents": [ … ] },
  "usage": { … },
  "compliance": { "not_for_sale_to_us_residents_in_us_waters": false, "vat_status": "paid" }
}
```

Three principles the envelope depends on:

- **Complete objects, null for missing** — every response contains the full schema so consumers never branch on field presence.
- **Normalised references** — builders, models, and types are shared vocabulary so cross-node search doesn't degrade into string matching. Builder, category, and charter-destination slugs come from fixed, versioned registries (`registry/builders.json`, `registry/categories.json`, `registry/destinations.json`, published under `https://openyacht.org/registry/`, vendored by nodes — never fetched at request time); model slugs are builder-scoped and node-curated. Rules and rationale in `listing-schema.md` *Shared vocabulary*; registry governance for the remaining vocabularies (features, models) is a v1.x decision.
- **Charter listings share the same envelope** with `type: "charter"` and a `charter` block (rates by season, capacities). Charter *availability calendars and bookings are explicitly out of protocol scope for v1* — that scope sank an earlier design effort, and inventory sharing does not need it.

Tombstone payload:

```json
{ "id": "https://…/listings/018f…", "tombstone": true, "status": "withdrawn", "updated_at": "…" }
```

### Subscriptions (push)

Polling `updated_since` is the baseline every node must support. Nodes that advertise the `subscriptions` feature also accept:

```
POST   /openyacht/v1/subscriptions        { "callback": "https://consumer.example/openyacht/v1/inbox" }
DELETE /openyacht/v1/subscriptions
```

On changes, the authority POSTs the changed listing (or tombstone) to the partner's callback, signed exactly like any federation request (the consumer verifies it the same way). Delivery is at-least-once with exponential-backoff retries for 24 hours; consumers deduplicate on `(id, updated_at)`. A subscription does not relieve the consumer of periodic reconciliation polls (RECOMMENDED: daily), because missed webhooks are a fact of life.

### Partners

```
POST /openyacht/v1/partners/request      { "message": "…", "contact_email": "…" }
```

Covered in `federation-protocol.md`. There is no partner *listing* endpoint in v1: who a brokerage shares with is its own business, and enumerating relationships is an information leak with no protocol need.

### Health

```
GET /openyacht/v1/health                 (unsigned)
→ { "status": "ok", "time": "…" }
```

## Errors

```json
{
  "error": {
    "code": "SIGNATURE_INVALID",
    "message": "Signature verification failed after key refresh",
    "details": { "well_known": "/.well-known/openyacht" }
  },
  "meta": { "request_id": "…", "time": "…" }
}
```

Defined codes: `SIGNATURE_INVALID`, `TIMESTAMP_OUT_OF_RANGE`, `PARTNER_UNKNOWN`, `PARTNER_BLOCKED`, `PARTNER_PROVISIONAL` (authenticated but not yet approved for this resource), `NOT_FOUND`, `GONE` (terminal listing past retention), `RATE_LIMITED`, `VALIDATION_ERROR`, `VERSION_UNSUPPORTED`. HTTP status codes follow the obvious mapping (401, 401, 401, 403, 403, 404, 410, 429, 422, 400).

## Rate Limiting

Per-partner limits are advertised in `capabilities.limits` and enforced with `429` plus a `Retry-After` header. RECOMMENDED default: 500 requests/hour with burst allowance for initial synchronisation. A first full sync of a large inventory is the pathological case; nodes SHOULD allow a negotiated bulk window (or simply raise the limit for `verified` partners) rather than forcing a multi-day trickle.

## Implementation Notes (non-normative)

- Serve `/listings` from queries tuned for this purpose (raw, index-covered queries are the production-validated approach for federation endpoints on high-volume nodes); the 24-hour update obligation in `yacht-identity.md` means consumers hit `updated_since` frequently, so that path is the hot one.
- Cache-invalidate on write: the `updated_at` a consumer sees MUST reflect the change they are being told about; a stale cache in front of `updated_since` breaks the no-missed-removals guarantee.
- Log every inbound federation request with partner, endpoint, and verification outcome; this audit trail is both the debugging tool and the evidence base for `usage` compliance questions.
