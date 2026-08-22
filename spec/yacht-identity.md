# Yacht Identity, Authority, and Provenance

**Status**: Draft v0.1 (2026-08).
**Audience**: Implementers, and technical reviewers at partner brokerages. This is the document that answers "who owns the record?"

## Why this document exists

Yachts have no universal identifier. The same vessel appears on many websites under different names (vessels are renamed routinely), with different photos, prices, and specifications, listed by a central agent and re-marketed by any number of co-brokers. Scraping-based aggregators attempt to reconcile this after the fact and visibly fail: duplicates, stale prices, wrong photos. A federation solves it structurally — every record has exactly one authoritative source, and everyone else holds a *reference* to it. This document defines how.

Three distinct concepts, deliberately separated:

| Concept | What it is | Identified by |
|---|---|---|
| **Vessel** | The physical boat | Real-world identifiers (HIN, IMO, …), best-effort |
| **Listing** | One brokerage's mandate to sell/charter that vessel, at a time | Canonical listing URI, exact |
| **Copy** | Another node's stored representation of a listing | Provenance block, exact |

## Listing Identity

Every listing has a **canonical URI** minted by the node that created it:

```
https://{authority-domain}/openyacht/v1/listings/{uuid}
```

- The UUID is generated once, at creation, and never reused.
- The canonical URI is the listing's globally unique identifier. Consuming nodes MUST store and compare it as an opaque string, and MAY dereference it (a signed GET) to fetch the current state of the listing.
- The canonical URI never changes for the life of the listing, including through price changes, status changes, and withdrawal.

This is the ActivityPub pattern: the identifier *is* the location of the truth.

## Authority

The node that minted a listing's canonical URI is that listing's **authority**. The authority is the only node that may:

- change the listing (price, specifications, media, status);
- distribute updates for it;
- withdraw it.

A listing SHOULD be created on the node of the brokerage holding the **central agency agreement** (or equivalent listing mandate) for the vessel. The protocol cannot verify contracts; what it enforces is the weaker but sufficient invariant that *every record has exactly one writer*.

### What everyone else holds

A node that receives a listing from a partner stores it as a **copy** with a mandatory provenance block:

```json
"provenance": {
  "canonical": "https://authority.example/openyacht/v1/listings/018f…",
  "authority": "authority.example",
  "received_at": "2026-08-20T10:30:00Z",
  "signature_verified": true
}
```

Rules for copies:

1. A node MUST NOT present a copy as its own listing in federation responses. Copies are either excluded from a node's `/listings` output, or included with their original provenance intact — never re-minted under a new canonical URI.
2. A node MUST NOT modify the substantive content of a copy (it MAY store private annotations — internal notes, its own commission terms — alongside, clearly separated).
3. When the authority distributes an update or withdrawal, copies MUST be updated within 24 hours, and withdrawn listings MUST be removed from public display within the same period. (Nodes learn of changes by subscription push or by polling `updated_since` — see `api-design.md`.)
4. Re-sharing a copy onward ("relay") is prohibited in protocol v1. Every node obtains listings directly from their authority. This keeps the trust chain one hop long and makes rule 3 enforceable. Relay with signed provenance chains is a possible v2 feature; it is out of scope now.

## Vessel Identity

Listings carry an optional but strongly recommended `vessel` block containing real-world identifiers:

```json
"vessel": {
  "hin": "US-ABC12345D404",
  "imo": null,
  "mmsi": "366123456",
  "official_number": null,
  "builder": { "name": "Benetti", "slug": "benetti" },
  "model": { "name": "Oasis 40M", "slug": null },
  "year_built": 2021,
  "refit_year": null,
  "loa_m": 40.8,
  "previous_names": ["ANDIAMO"]
}
```

Purpose: **matching, not authority**. Vessel identifiers let a receiving node recognise that two listings — or a new listing and an old sold record — concern the same physical boat. They confer no rights over the record.

Matching guidance (informative):

- An exact `hin` or `imo` match SHOULD be treated as the same vessel. These are the strongest identifiers (IMO numbers are permanent; HINs are permanent but only present on vessels built or imported under HIN regimes).
- `mmsi` and `official_number` follow the *registration*, which changes with flag/owner — treat a match as strong evidence, not proof.
- Absent hard identifiers, `builder + model + year_built + loa_m` within tolerance is a candidate match requiring human confirmation. Vessel names are the *weakest* signal; boats are renamed constantly, which is why `previous_names` exists.

## Lifecycle

Listing `status` values and legal transitions:

```
draft → active → { under_offer ⇄ active } → sold | withdrawn
```

- `sold` and `withdrawn` are terminal for the listing. A returning vessel gets a *new* listing (new UUID), linked to its history by the vessel block.
- The authority SHOULD retain terminal listings and continue serving them at their canonical URI (with status) for at least 12 months, so partners' dereferences do not 404 while their cleanup runs. After that, a dereference MAY return `410 Gone`.

### Central agency changes

When a vessel's mandate moves from brokerage A to brokerage B:

1. A withdraws its listing (status `withdrawn`, distributed normally).
2. B creates a new listing on its own node with a new canonical URI, populating the `vessel` block.
3. Consuming nodes that hold both records can connect them by vessel matching. The protocol does not transfer listing records between authorities — mandate disputes are a real-world matter, and the network's job is only to make each side's claim visible and attributable.

If two `active` listings from different authorities match the same vessel on a hard identifier, consuming nodes MUST NOT auto-resolve the conflict. Both copies are retained, the conflict is flagged for human review, and public display behaviour is the operator's policy decision. (This situation is usually a mandate handover in progress or a genuine dispute; software adjudicating it would be wrong half the time.)

## Sharing Permissions and Usage Terms

The authority attaches sharing rules per listing and per partner (or partner trust level). The payload a given partner receives is the *already-filtered* view; there are no "please don't look at this field" markers.

Field groups an authority can grant or withhold per partner: `pricing`, `location_exact` (marina/GPS vs display region), `media_original` (hi-res vs watermarked/derived), `documents`, `vessel_identifiers`, and `history` (price/status history).

Every distributed listing carries a `usage` block — the terms under which the receiving brokerage may use the data:

```json
"usage": {
  "display": true,
  "attribution_required": true,
  "attribution_text": "Listing courtesy of Example Yacht Brokerage",
  "marketing_materials": true,
  "ai_indexing": true,
  "expires_with_listing": true
}
```

`expires_with_listing: true` (the default and RECOMMENDED value) means all use of the data and media MUST cease when the listing is withdrawn or the partnership ends — this, plus the 24-hour update rule, is the protocol's answer to the watermarked-image-in-a-stale-brochure problem. These terms are protocol-level defaults intended to be backed by the inter-brokerage agreements partners already sign; the protocol makes the terms machine-readable and auditable, it does not replace the contract.

## Media Identity

Images and documents are referenced by URL on the authority's infrastructure, with a content hash:

```json
{
  "url": "https://authority.example/media/listings/018f…/02.jpg",
  "sha256": "9f2b…",
  "category": "exterior",
  "width": 4000,
  "height": 2667,
  "caption": "Aft deck at anchor",
  "sort": 1
}
```

- Partners MAY cache media for performance; the hash makes cache validation and deduplication trivial and provides tamper evidence.
- Cached media inherits the listing's `usage` terms, including `expires_with_listing`.
- The authority SHOULD serve media URLs without federation signatures (plain HTTPS, unguessable paths) so partners' websites can embed or proxy them; hi-res originals gated by the `media_original` field group SHOULD use expiring signed URLs.

## Summary of MUSTs

For a quick compliance review: a node MUST (1) mint immutable canonical URIs for its own listings only; (2) store provenance on every copy; (3) never re-mint, substantively modify, or relay a copy; (4) apply authority updates and withdrawals within 24 hours; (5) retain vessel-conflict records for human review rather than auto-resolving; (6) honour the `usage` block, including cessation on expiry.
