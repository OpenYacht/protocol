# Conformance Checklist

**Status**: Draft v0.1 (2026-08) — the normative requirements of all four spec documents collected into one self-certification sheet. On any discrepancy, the source document wins; each item cites it. IDs are stable once published — new items get new IDs, removed items are struck, never renumbered.

**How to use**: work through the MUST tables for the roles you implement. *Authority* (A) = serving your own listings to partners; *Consumer* (C) = receiving partners' listings. Most nodes are both. An implementation conforms if every applicable MUST holds. The SHOULD table is not required for conformance but each deviation deserves a written reason.

Sources: `federation-protocol.md` (FP), `yacht-identity.md` (ID), `api-design.md` (API), `listing-schema.md` (LS).

## Identity, discovery, and keys (FP)

| ID | A/C | Requirement |
|---|---|---|
| FP-1 | A+C | Serve `GET /.well-known/openyacht` over HTTPS with a valid certificate, containing protocol versions, node UUID, name, keys array, and endpoint map. |
| FP-2 | A+C | Never accept a partner's well-known document or federation traffic over plain HTTP or invalid TLS. |
| FP-3 | A+C | Sign with Ed25519 (RFC 8032); key ID = first 16 hex chars of SHA-256 of the raw 32-byte public key. |
| FP-4 | A+C | Store the private key encrypted at rest; include it in encrypted backups only; never log private keys (or full signatures at debug level) in production. |
| FP-5 | A+C | Generate a node UUID at installation and publish it in the well-known document. |

## Request signing and verification (FP)

| ID | A/C | Requirement |
|---|---|---|
| FP-6 | A+C | Sign every request under `/openyacht/v1/` except `health` and `capabilities`, sending all four `X-OpenYacht-*` headers (node, key, timestamp, signature). |
| FP-7 | A+C | Build the signing string exactly as specified: method `\n` path+query `\n` lowercase host `\n` timestamp `\n` lowercase-hex SHA-256 of the raw body (empty-string hash when bodyless). |
| FP-8 | A+C | Reject requests whose timestamp is outside ±300 seconds of server time. |
| FP-9 | A+C | Reject all requests from `blocked` partners. |
| FP-10 | A+C | On verification failure, refetch the sender's well-known document once (fresh, rate-limit-respecting) and retry; on second failure reject with `401` and log. |
| FP-11 | A+C | On a node-UUID change for a known domain: downgrade the partner to `provisional`, reject the request, and notify administrators. |
| FP-12 | A+C | If a partner key is pinned, accept other keys only after administrator confirmation, even when the well-known document serves them. |
| FP-13 | A+C | Treat first contact from an unknown domain as `provisional`: no data shared beyond what provisional trust allows, until human approval. |
| FP-14 | A+C | Treat all inbound listing content as untrusted input: sanitise HTML, validate media URLs, no unchecked hotlinking into admin interfaces. |
| FP-15 | C | Flag listings from a partner unreachable beyond your staleness threshold (RECOMMENDED: 7 days) as stale in any consuming UI. |
| FP-16 | A+C | Never require a prospective partner to appear in the node directory or treat absence from it as a signal; never treat a directory entry as endorsement, identity verification, or trust — the node's own documents win on any conflict. |

## Listing identity, authority, and copies (ID)

| ID | A/C | Requirement |
|---|---|---|
| ID-1 | A | Mint canonical URIs (`https://{domain}/openyacht/v1/listings/{uuid}`) only for your own listings; the UUID is generated once and never reused; the URI never changes for the life of the listing. |
| ID-2 | C | Store and compare canonical URIs as opaque strings. |
| ID-3 | C | Store a provenance block (canonical URI, authority domain, received_at, signature_verified) on every copy. |
| ID-4 | C | Never present a copy as your own listing: exclude copies from your `/listings` output, or include them with original provenance intact — never re-minted. |
| ID-5 | C | Never modify the substantive content of a copy (private annotations kept clearly separate are allowed). |
| ID-6 | C | Never re-share a copy onward (no relay in v1); obtain every listing directly from its authority. |
| ID-7 | C | Apply authority updates and withdrawals to copies within 24 hours; remove withdrawn/sold listings from public display within the same period. |
| ID-8 | A | Respect the lifecycle: `draft → active ⇄ under_offer → sold | withdrawn`; `sold`/`withdrawn` are terminal; a returning vessel gets a new listing with a new UUID. |
| ID-9 | C | When two active listings from different authorities hard-match the same vessel (HIN/IMO): retain both, flag for human review, never auto-resolve. |
| ID-10 | A+C | Honour the `usage` block; when `expires_with_listing` is true, cease all use of data and media (including cached media) when the listing ends or the partnership terminates. |

## API surface and sync (API)

| ID | A/C | Requirement |
|---|---|---|
| API-1 | A | Serve the federation API under `/openyacht/v1/` on the identity domain; all bodies JSON UTF-8; timestamps RFC 3339 UTC. |
| API-2 | A | Support `updated_since` polling as the baseline sync mechanism, with cursor pagination (`meta.next_cursor`, absent on last page). |
| API-3 | A | Include tombstones in `updated_since` results for every listing that became invisible to the requesting partner (withdrawn, sold, or unshared) — a polling consumer must never miss a removal. |
| API-4 | A | Ensure the `updated_at` a consumer sees reflects the change being reported (cache-invalidate on write); a stale cache in front of `updated_since` is non-conformant. |
| API-5 | A | Filter every response server-side to the requesting partner's sharing rules; never send withheld data with "please ignore" semantics. |
| API-6 | A | Serve unsigned `GET /openyacht/v1/capabilities` (protocol versions, feature flags, limits) and `GET /openyacht/v1/health`. |
| API-7 | C | Check `capabilities.features` before using an optional feature; degrade gracefully when absent. |
| API-8 | C | Ignore unknown fields in all payloads. |
| API-9 | A | Use the defined error envelope and codes with their HTTP mappings (`SIGNATURE_INVALID` 401, `PARTNER_BLOCKED` 403, `GONE` 410, `RATE_LIMITED` 429 + `Retry-After`, etc.). |
| API-10 | A | If advertising `subscriptions`: accept `POST`/`DELETE /openyacht/v1/subscriptions`, sign every delivery like any federation request, retry with exponential backoff for 24 hours. |
| API-11 | C | If subscribed: deduplicate deliveries on `(id, updated_at)`, and still reconcile by polling — a subscription never replaces `updated_since`. |
| API-12 | A | Serve monetary amounts as strings of decimal digits with ISO 4217 currency codes — never floats. |

## Listing payload (LS)

| ID | A/C | Requirement |
|---|---|---|
| LS-1 | A | Emit every field defined for the listing's `type`, with `null`/`[]` for unknown or withheld values — consumers must never need to branch on field presence. |
| LS-2 | A | snake_case names; canonical metric units only (`_m`, `_kg`, `_l`, `_kn`, `_nmi`, `_lph`); no imperial values, unit fields, or formatted display strings. |
| LS-3 | A | One currency per amount: the listing currency only; no pre-converted prices anywhere in the payload. |
| LS-4 | A | Restrict rich text to the allowed HTML subset, in `descriptions[].content` only; no markup in any other field. |
| LS-5 | C | Sanitise `descriptions[].content` before rendering, regardless of what the authority sent. |
| LS-6 | A | Use closed-enum values exactly as defined; emit `null` for unmappable values, never invented strings. Private extensions use the `x_` prefix. |
| LS-7 | A | Never distribute `draft` listings. |
| LS-8 | A | `media.profile` is populated whenever the listing has any imagery, always including a non-null `thumbnail_url`; a listing with no imagery has `profile: null` — never a generated placeholder image. |
| LS-9 | C | Use `media.profile` as the representative image; never fall back to first-gallery-entry when it is present. |
| LS-10 | A | `price_history` is ordered most-recent-first and its first entry equals the current price; charter listings carry `listing.price: null` and pricing in `charter.rates`. |
| LS-11 | A | `vessel.builder.slug` and `specifications.category.slug`, when non-null, are slugs present in the vendored builder/category registries — never invented. |
| LS-12 | C | Validate incoming builder and category slugs against the vendored registries; on unknown slug fall back to the name and flag the registry copy for update; never invent a mapping. |
| LS-13 | A | Vendor the builder and category registries; never fetch them (or any third-party resource) as part of validating or serving a listing at request time. |
| LS-14 | A | Apply field-group gating exactly per the gating map (`pricing`, `location_exact`, `media_original`, `documents`, `vessel_identifiers`, `history`) — withheld values are nulled/emptied server-side. |
| LS-15 | A | Distribute charter crew data only while holding an attestation from the charter manager or captain that they are authorised to publish it; crew data inherits the listing's `usage` terms including expiry. |
| LS-16 | A | When non-null, a gallery or layout `thumbnail_url` is a rendition of the same image as its `url` — never a different photograph; `null` means no small rendition is served. |

## SHOULD / RECOMMENDED (not required for conformance; deviations deserve a written reason)

| Source | Recommendation |
|---|---|
| FP | Choose the identity domain under the business's recognisable domain (a dedicated subdomain is the recommended pattern); serve federation endpoints only on the identity domain when the node is reachable under multiple hostnames. |
| FP | Cache partners' well-known documents for 24 h; rate-limit the well-known endpoint (~1 req/min/consumer). |
| FP | Pin keys out of band with high-value partners; reject duplicate (node, timestamp, signature) tuples within the timestamp window. |
| FP | Routine key rotation with ~48 h overlap; back off exponentially on partner failures (cap ~24 h); hide stale partner data from public display after 30 days unreachable (the stale *flag* itself is FP-15, a MUST). |
| ID | Create listings on the node of the brokerage holding the central agency agreement; retain terminal listings at their canonical URI for ≥12 months before `410 Gone`. |
| API | Reconciliation poll daily even when subscribed; default rate limit 500 req/h with a negotiated bulk window for initial sync. |
| LS | Builder data entry as a fixed registry choice with an explicit "unlisted" escape hatch; use well-known `descriptions[].section` labels (`overview`, `highlights`) where they apply. |
