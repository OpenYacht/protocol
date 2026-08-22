# Listing Wire Schema

**Status**: Draft v0.1 (2026-08) — designed against the listing data brokerages actually hold and exchange today, not in the abstract. Every field earns its place from the field models of working brokerage systems and from long experience integrating the industry's listing sources; nothing here is speculative.
**Prerequisites**: `api-design.md` (envelope, endpoints, error contract), `yacht-identity.md` (canonical URIs, authority, provenance, usage terms, media identity), `federation-protocol.md` (signing).
**Open questions for reviewers are marked ⚠ inline and collected at the end.**

This document defines the field-by-field payload of a listing as served by its authority at `GET /openyacht/v1/listings/{uuid}` and in `/listings` collection responses. It fills in the structural contract fixed in `api-design.md`.

## Conventions (normative)

These apply to every field in this document and to any future extension:

1. **Naming**: `snake_case`, ASCII, singular for scalars, plural for arrays. Unit-bearing numeric fields carry a unit suffix (below). These rules apply identically to sale and charter listings and to every nested block.
2. **Complete objects, null for missing.** Every listing payload contains every field defined here for its `type`. A value the authority does not have — or that the receiving partner's sharing rules withhold (see *Field groups*) — is `null` (or `[]` for arrays). Consumers never branch on field *presence*; they MAY need to handle `null` anywhere except the fields marked **required** below.
3. **Unknown fields MUST be ignored** by consumers (per `api-design.md`); authorities MAY add private extension fields prefixed `x_` without a version bump.
4. **Units are canonical metric, one unit per concept.** No imperial values, no unit fields, no formatted display strings on the wire — presentation is the consumer's job. Suffixes: `_m` metres, `_kg` kilograms, `_l` litres, `_kn` knots, `_nmi` nautical miles, `_lph` litres per hour, `_hp` / `_kw` for engine power. `gross_tonnage` is dimensionless (GT). Decimals are JSON numbers.
5. **Money is never a float.** Monetary amounts are strings of decimal digits with optional `.` separator, paired with an ISO 4217 `currency` code (per `api-design.md`). A single currency per amount: the wire carries the asking price or rate in its listing currency only. Pre-converted values are prohibited — stale conversions are a failure mode this protocol exists to eliminate; consumers convert with their own rates.
6. **Timestamps** are RFC 3339 UTC (`2026-08-19T16:05:00Z`). **Dates** without time-of-day (e.g. rate validity) are `YYYY-MM-DD`.
7. **Rich text** (`descriptions[].content` only — no other field accepts markup) is a restricted HTML subset: `p`, `br`, `ul`, `ol`, `li`, `strong`, `em`, `h3`, `h4`, `a[href]` (https only). No attributes besides `a[href]`, no styles, classes, scripts, images, or tables. Authorities SHOULD strip nonconforming markup on ingest; consumers MUST sanitise before rendering regardless.
8. **Enums** are closed sets defined here; an authority that cannot map a value uses `null` (never an invented string). Vocabulary fields (builder, category, features) are open *names* with optional well-known *slugs* — see *Shared vocabulary*.

## Top level

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string (URI) | ✔ | Canonical listing URI, per `yacht-identity.md`. Immutable. |
| `type` | enum | ✔ | `sale` \| `charter`. Immutable. A vessel both for sale and for charter is two listings, linked by their `vessel` blocks. |
| `status` | enum | ✔ | `active` \| `under_offer` \| `sold` \| `withdrawn`. `draft` exists in the lifecycle (`yacht-identity.md`) but is never distributed. `sold` / `withdrawn` normally arrive as tombstones (`api-design.md`); the full payload form occurs only when dereferencing a terminal listing within its retention window. |
| `updated_at` | timestamp | ✔ | Last change to federation-visible state. Drives `updated_since` sync. |
| `listed_at` | timestamp | | When the listing went active. |
| `condition` | enum | | `new` \| `used`. |
| `agreement` | object | | Mandate metadata: `{ "type": "central" \| "exclusive" \| "open" \| null, "co_brokerage": bool \| null }`. ⚠ Open question 5. |
| `vessel` | object | ✔ | See *Vessel*. |
| `listing` | object | ✔ | Commercial block — see *Listing*. |
| `specifications` | object | ✔ | See *Specifications*. |
| `descriptions` | array | ✔ | See *Descriptions*. |
| `features` | array | ✔ | See *Features*. |
| `media` | object | ✔ | Typed collections with an explicit profile image — see *Media*. |
| `charter` | object \| null | ✔ | Charter-only block; `null` when `type` is `sale`. See *Charter*. |
| `usage` | object | ✔ | Usage terms, defined normatively in `yacht-identity.md`. |
| `compliance` | object | ✔ | See *Compliance*. |

## Vessel

Real-world identity of the physical boat, for matching (`yacht-identity.md` defines the semantics; this defines the shape). All fields nullable; populate everything known.

| Field | Type | Description |
|---|---|---|
| `hin` | string | Hull Identification Number. |
| `imo` | string | IMO number (permanent; large yachts). |
| `mmsi` | string | MMSI (follows registration — strong evidence, not proof). |
| `official_number` | string | National registry official number. |
| `builder` | vocab | `{ "name": "Benetti", "slug": "benetti" }` — slug from the builder registry, never invented. See *Shared vocabulary*. |
| `model` | vocab | Same shape; slug is builder-scoped, node-curated. See *Shared vocabulary*. |
| `year_built` | integer | Year of build (delivery). |
| `refit_year` | integer | Most recent significant refit; `null` if none. |
| `loa_m` | number | Length overall, metres. |
| `previous_names` | array of strings | Former vessel names — the matching aid for renamed boats. |

Sale-listing sources commonly carry none of `imo`, `mmsi`, or `previous_names`; imported listings will hold `null` there until enriched. That is expected and correct — nulls that say "unknown" beat guesses.

## Listing

The commercial facts of this mandate.

| Field | Type | Description |
|---|---|---|
| `name` | string, required | Current marketing name of the vessel. |
| `summary` | string | Plain-text teaser (no markup). |
| `price` | object | Sale listings: `{ "amount": "8500000", "currency": "EUR", "on_application": false, "starting_price": false }`. `amount` and `currency` are `null` when `on_application` is true or the partner lacks the `pricing` field group. `starting_price` marks new-build/configure-to-order base prices. **Charter listings: the whole object is `null`** — charter pricing is `charter.rates`. |
| `price_history` | array | `[{ "amount": "8900000", "currency": "EUR", "changed_at": "2026-05-01T09:00:00Z" }, …]` — every asking price the listing has had, **most recent first**; the first entry always matches the current `price`. `[]` unless the partner has the `history` field group. |
| `location` | object | `{ "display": "Palma de Mallorca, Spain", "city": "Palma de Mallorca", "state": null, "country": "ES", "marina": null, "coordinates": null }`. `country` is ISO 3166-1 alpha-2. `display` is required within the object and is the authority's chosen public wording. `marina` and `coordinates` (`{ "lat": …, "lon": … }`) require the `location_exact` field group. |
| `brokers` | array | Ordered, first entry is the lead broker: `[{ "name": "…", "title": null, "email": "…", "phone": null, "photo_url": null }]`. Brokerage identity is the authority node itself (`federation-protocol.md`); this block exists for attribution and contact, not identity. |

## Specifications

One flat object; grouped here only for readability. All fields nullable except `power_or_sail` (see *Classification*).

**Dimensions & weights** — `beam_m`, `draft_max_m`, `draft_min_m`, `lwl_m` (waterline length), `lod_m` (length on deck), `bridge_clearance_m`, `gross_tonnage`, `displacement_kg`.

**Capacities** — `fuel_capacity_l`, `water_capacity_l`, `holding_tank_l`.

**Performance** — `cruise_speed_kn`, `max_speed_kn`, `range_nmi` (at cruise), `fuel_consumption_lph` (at cruise).

**Construction** — `hull_material`, `superstructure_material`, `deck_material`, `hull_shape` (enum: `planing` \| `semi_displacement` \| `displacement` \| `hydrofoil` \| `catamaran` \| `trimaran`), `hull_color`, `naval_architect`, `exterior_designer`, `interior_designer`, `fuel_type` (enum: `diesel` \| `petrol` \| `electric` \| `hybrid`), `flag` (country name as registered), `registry_port`.

**Classification** — `power_or_sail` (enum: `power` \| `sail`, **required — the one non-nullable specification**: every listing can state it, and consumers' top-level inventory split depends on it) and `category` (vocab: `{ "name": "Motor Yacht", "slug": "motor-yacht" }`). Two independent axes, per the production systems. The category vocabulary is a **fixed registry** at [`../registry/categories.json`](../registry/categories.json), governed like the builder registry — see *Shared vocabulary → The category registry*.

**Accommodations** — totals plus two *linked but distinct* structured breakdowns, and a separate crew block (industry consultation, 2026-08: cabin configuration and bed configuration are different facts, and crew capacity hides real variation when flattened to one number):

- Totals: `cabins`, `sleeps`, `heads`, `guests_cruising`, `guests_entertaining`.
- **Guest capacities are three separate facts**: `sleeps` is the overnight capacity; `guests_cruising` is the number carried under way (the regulatory limit for a commercially registered yacht — commonly 12); `guests_entertaining` is the number carried while static, at anchor or dockside — typically much higher, and quoted routinely for events. Collapsing them loses real information: a yacht sleeping 11 and cruising 12 may entertain 35. All are nullable — an authority without a figure sends `null` rather than repeating another. *(They live here rather than in the charter block because they are facts about the vessel — sale listings quote them too.)*
- `cabin_config` — room-level properties: `{ "double": 4, "twin": null, "triple": null, "single": 0, "convertible": 3 }`. A `convertible` cabin is one that can be split/re-made (the room count is fixed; how it presents is not).
- `berth_config` — sleeping surfaces in the *typical/default* makeup: `{ "king": 4, "queen": 3, "double": null, "twin": null, "single": null, "pullman": 0, "bunk": null }`. Because convertibles change presentation (4 double + 3 convertible cabins can present as 4 king + 3 queen *or* 4 king + 6 twin), `berth_config` describes the default; per-booking makeup is out of scope.
- `crew_accommodation` — `{ "cabins": 2, "berths": 4, "layout": "2 rooms, 2 sets of bunks" }` (replaces flat crew counts; a stated "4 crew berths" can hide e.g. captain and partner sharing one cabin — room count and layout are the operationally asked questions).

All fields nullable. Free-text bed descriptions beyond `layout` go in `descriptions`, not here.

**Machinery** — two arrays:

```json
"engines": [
  {
    "make": "Volvo", "model": "D11", "year": 2016,
    "type": "inboard", "drive_type": "Direct",
    "power_hp": 675, "power_kw": 503.35,
    "fuel_type": "diesel", "hours": 777,
    "hours_recorded_at": "2024-03-05", "location": "starboard"
  }
],
"generators": [
  { "make": "Onan", "model": null, "power_kw": 21, "hours": 550, "hours_recorded_at": null }
]
```

`engines[].type`: `inboard` \| `outboard` \| `saildrive` \| `pod` \| `jet`. Engine serial numbers are deliberately not on the wire (private annotation territory).

**Tenders & toys (sale)** — `tenders`: free-text string. Structure here is unproven in every source; do not invent it. Structured water toys belong in `features`.

## Descriptions

Ordered array of rich-text sections:

```json
"descriptions": [
  { "section": "overview", "content": "<p>…</p>" },
  { "section": "highlights", "content": "<ul><li>…</li></ul>" },
  { "section": "Notable Upgrades", "content": "<p>…</p>" }
]
```

- `section` is a label, not an enum; the well-known values `overview` and `highlights` SHOULD be used where they apply so consumers can place them predictably.
- `content` follows the restricted-HTML rule (Conventions §7).
- Order is the authority's intended display order.

## Features

The normalised equipment/amenity list — one mechanism for sale amenities, charter toys, and the feed checkbox flags:

```json
"features": [
  { "category": "comfort", "name": "Air conditioning", "slug": "air-conditioning" },
  { "category": "deck", "name": "Elevator", "slug": "elevator" },
  { "category": "toys", "name": "Yachtwerft Meyer limousine tender", "slug": null }
]
```

- `name` is required free text; `slug` is an optional well-known identifier; `category` is an optional grouping label.
- Rationale (production-proven): aggregator feeds deliver equipment as broker-filled free text plus a handful of structured checkboxes; extracting structure from the text is an *import* problem, never a wire problem. A federation node's own listings are first-party data — structured at entry. Feed checkbox flags (elevator, helipad, flybridge, stabilisers, thrusters, wheelchair access, …) map to well-known slugs rather than dedicated top-level fields, so there is exactly one place to look.
- The initial well-known slug list is non-normative and maintained alongside the other vocabulary curation material; slug registry governance is a v1.x decision (`api-design.md`).

## Media

`media` is an **object of typed collections**, not one mixed array — a gallery image, a GA plan, a walkthrough video, and a brochure PDF are consumed differently, so they are delivered separately:

```json
"media": {
  "profile":   { "url": "…", "sha256": "…", "width": 4000, "height": 2667, "caption": "…", "thumbnail_url": "…" },
  "gallery":   [ { "url": "…", "sha256": "…", "category": "exterior", "width": …, "height": …, "caption": "…", "sort": 1 } ],
  "layouts":   [ { "url": "…", "sha256": "…", "width": …, "height": …, "caption": "GA", "sort": 1 } ],
  "videos":    [ { "url": "https://vimeo.com/…", "sha256": null, "caption": "Walkthrough", "sort": 1 } ],
  "tours":     [ { "url": "…", "caption": null, "sort": 1 } ],
  "documents": [ { "url": "…", "sha256": "…", "caption": "Sample menu", "sort": 1 } ]
}
```

- **`profile` is a dedicated, explicit hero image** — a single image object, `null` only if the listing genuinely has no imagery. Consumers MUST use it as the listing's representative image and MUST NOT fall back to "first gallery entry" when it is present. *Rationale*: source systems order their image lists for their own purposes — print layout, upload order, category grouping — and none of those reliably surfaces the best representative shot, so "use the first image" conventions routinely produce a listing represented by a deck plan or a detail shot. The authority chooses the hero shot, once, explicitly. The profile image need not be repeated in `gallery`.
- `gallery[].category`: `exterior` \| `interior` \| `lifestyle` \| `crew` \| `null`. Order within the gallery is `sort`.
- `layouts` holds GA/deck plans as images; plan PDFs belong in `documents`.
- `videos` and `tours` MAY point to external platforms (YouTube, Vimeo, Matterport…) — `sha256` is `null` for external URLs, required for files hosted by the authority.
- Hashing, caching, usage inheritance, and URL-serving rules for all image/document files are defined in `yacht-identity.md`. Each item carries **one URL — the best resolution the receiving partner is granted**; derived sizes are not on the wire, partners generate their own. *Rationale (settled by industry consultation, 2026-08)*: feeds that ship multiple pre-generated sizes never agree on a standard size set, so multi-source consumers end up resizing anyway; one large image resized to the receiver's own needs (locally or via an on-the-fly image CDN) is the simpler contract. Hi-res originals are gated by the `media_original` field group; without it the URL points to the authority's watermarked/derived rendition, with `sha256`, `width`, `height` describing *that* file.
- The one exception: `profile.thumbnail_url` — a small, authority-served rendition of the profile image, for share cards, listing pickers, and other contexts where a consumer reasonably wants a preview without running an image pipeline. **Required (non-null) whenever `profile` is present.** No dimensions are mandated; ~400–640 px on the long edge is the sensible range. It inherits the listing's `usage` terms like any cached media.
- **Placeholders are prohibited.** A listing with no imagery has `media.profile: null` — an authority MUST NOT serve a generated blank/placeholder image in its place. *Rationale*: a synthesised placeholder is indistinguishable from real imagery to a consumer, so "does this listing have a photograph?" stops being answerable programmatically — and a consumer that cannot answer it cannot filter on it, rank by it, or chase the gap with the authority. `null` keeps the question machine-checkable: it means no image, and anything non-null is a real photograph or rendering of the vessel.
- `documents` (brochures, plan PDFs, sample menus) requires the `documents` field group; without it the array is served as `[]` (a URL you may not use is worse than no entry).

## Charter

Present only when `type` is `charter`; everything outside this block is identical to a sale listing.

```json
"charter": {
  "rates": [
    {
      "season": "summer",
      "rate_type": "weekly",
      "amount_min": "435000",
      "amount_max": "480000",
      "currency": "EUR",
      "contract_terms": "MYBA",
      "apa_percent": 30,
      "vat_percent": null,
      "valid_from": "2026-05-01",
      "valid_to": "2026-09-30"
    }
  ],
  "operating_areas": [ { "name": "Western Mediterranean", "slug": "western-mediterranean", "season": "summer" } ],
  "summer_base_port": "Palma de Mallorca",
  "winter_base_port": "Antigua",
  "crew": [
    {
      "role": "Captain", "name": "…", "nationality": "British",
      "bio": "…", "photo_url": "https://…", "tba": false
    }
  ]
}
```

- Guest capacities (`sleeps`, `guests_cruising`, `guests_entertaining`) live in `specifications` — they are facts about the vessel, not the charter offer. See *Specifications → Accommodations*.
- `rates[].season`: `summer` \| `winter` \| a free-text label for special periods (regattas, holidays). `rate_type`: `weekly` \| `daily`. A fixed single rate uses `amount_min` = `amount_max`. `contract_terms` names the charter contract form (e.g. `MYBA`); `apa_percent` and `vat_percent` are numbers, not strings. Rates require the `pricing` field group.
- `operating_areas[]` uses the vocab shape (`name` required, `slug` optional) plus an optional `season`. Slugs come from the **destination registry** ([`../registry/destinations.json`](../registry/destinations.json)), governed exactly like the builder and category registries — see *Shared vocabulary → The destination registry*.
- `crew[]` entries with `tba: true` represent an unannounced position (`name` et al. `null`). Crew bios and photos are personal data: they inherit the listing's `usage` terms, including `expires_with_listing`. The distributing authority MUST hold an **attestation from the charter manager or captain that they are authorised to publish the crew data** (industry consultation, 2026-08: per-crew-member consent is not collectible at crew-turnover pace and was never the practice; the attestation standard is the honest, auditable one).
- Availability calendars and bookings are **out of protocol scope for v1** (see the scope boundaries in the repository `README.md`).

## Usage

Normative definition in `yacht-identity.md`. Shape, for completeness: `display`, `attribution_required`, `attribution_text`, `marketing_materials`, `ai_indexing`, `expires_with_listing` — all booleans except `attribution_text` (string).

## Compliance

| Field | Type | Description |
|---|---|---|
| `not_for_sale_to_us_residents_in_us_waters` | bool | Standard across the sale-listing systems in common use. |
| `vat_status` | string | **Free text**, not an enum (industry consultation, 2026-08: a wrong fixed list is worse than an unstructured field — it makes every listing using it assert a legally meaningless claim). `paid`, `not_paid`, `exempt` are *suggested* values, not enforced. A closed enum is deferred until reviewed by someone with real EU/UK VAT and US sales/use-tax expertise. ⚠ Open question 3 remains open for that expert list. |
| `ce_certified` | bool | |
| `mca_compliant` | bool | |
| `classification` | array | `[{ "society": "RINA", "notation": "Pleasure", "next_survey_due": "2027-04-01" }]`. |

## Field groups (gating map)

`yacht-identity.md` defines the field groups an authority grants per partner. The payload a partner receives is already filtered; withheld values are `null`/`[]`/omitted per this map:

| Field group | Withholding nulls/removes |
|---|---|
| `pricing` | `listing.price.amount`+`currency`, `charter.rates` |
| `location_exact` | `listing.location.marina`, `listing.location.coordinates` |
| `media_original` | swaps hi-res URLs for derived/watermarked renditions |
| `documents` | `media.documents` served as `[]` |
| `vessel_identifiers` | `vessel.hin`, `vessel.imo`, `vessel.mmsi`, `vessel.official_number` |
| `history` | `listing.price_history` |

## Shared vocabulary

`builder`, `model`, `category`, `features[]`, and `operating_areas[]` share one shape: `{ "name": string (required), "slug": string | null }`. Names are display truth; slugs are the interoperability mechanism. A consumer that does not recognise a slug falls back to the name.

### The builder registry

Builders are the vocabulary where free text demonstrably fails (broker-typed variants make cross-node search degrade into string matching), and they change slowly — so they get a **fixed registry**:

- The registry is a **versioned file** — the set list both sides validate against — maintained in the spec repository at `registry/builders.json` and published canonically at `https://openyacht.org/registry/builders.json`. Each entry: `{ "slug", "name", "country" }`. Versioning is date-based (`2026.08.0`), tzdata-style.
- Nodes **vendor a copy** and update it out-of-band (with software updates, or a periodic fetch of the published file). The registry is NEVER fetched at request time — validating or serving a listing MUST NOT depend on any third-party host, including openyacht.org.
- **Outgoing (authority)**: `vessel.builder.slug` MUST be a slug present in the registry, validated at data entry. Authorities MUST NOT invent slugs — a non-null slug on the wire is a claim of registry membership. A genuinely unlisted builder is sent as `{ "name": "…", "slug": null }`; the remedy is a registry pull request, not an improvised slug. When the registry catches up, the authority fills the slug on its next update, which propagates like any edit — no migration needed.
- **Incoming (consumer)**: validate a non-null `slug` against the vendored registry. Known slug → use it (and prefer the registry's canonical `name` for display/grouping). Unknown slug → the sender is on a newer registry version (or in error): fall back to the `name`, flag the registry copy for update. `slug: null` → store the free-text name as-is and flag for human curation. Consumers MUST NOT invent mappings.
- The registry is deliberately **alias-free**: it is a clean validation list, not a normalisation table. Alias matching ("Sunseeker International" → `sunseeker`) exists only where dirty data enters a node — feed import connectors — and it belongs to that connector: an implementer importing from a given source maintains whatever mapping that source's dirt requires. It is not protocol data, and no central alias list is published — the mappings a connector needs depend entirely on which sources it reads. Between OpenYacht nodes there is nothing to normalise: both ends validated against the same list before the data ever went on the wire.
- Governance is pull requests to the spec repository — no runtime service, no consensus protocol.

### The category registry

`specifications.category` follows the builder registry's model exactly, for the same reason: categories are how consumers group and filter cross-node inventory, and free-text categories degrade that into string matching. The registry is `registry/categories.json` (published canonically at `https://openyacht.org/registry/categories.json`). Each entry: `{ "slug", "name" }`; versioning, vendoring, outgoing/incoming validation, and governance are all as for builders — authorities MUST NOT invent category slugs, an uncategorisable listing is sent as `{ "name": "…", "slug": null }` (or `category: null`), and the remedy for a missing category is a registry pull request. Unlike builders, the category list is small and near-closed; additions should be rare and argued from real inventory that no existing category fits. Category names are singular, and category slugs MUST NOT encode the `power_or_sail` axis — power vs sail is already a separate, required field, so the registry carries one `catamaran`, never a power/sail pair.

### The destination registry

`charter.operating_areas[]` follows the same model: cruising grounds are how charter consumers filter and group inventory, and free-text destinations degrade that into string matching ("W. Med", "West Med", "Western Mediterranean"). The registry is `registry/destinations.json` (published canonically at `https://openyacht.org/registry/destinations.json`). Each entry: `{ "slug", "name", "parent" }`; versioning, vendoring, outgoing/incoming validation, and governance are all as for builders — authorities MUST NOT invent destination slugs, an unlisted cruising ground is sent as `{ "name": "…", "slug": null }`, and the remedy is a registry pull request.

Two things are specific to destinations:

- **The list is hierarchical, and every level is a valid value.** `parent` holds another entry's slug, or `null` for a top-level region. A yacht that ranges across a whole region references the region entry (`western-mediterranean`); one that works a single stretch references the specific entry (`french-riviera-monaco`). Authorities SHOULD send the most specific entry that is true, and MUST NOT send a parent and its own descendants in the same array — the parent already implies them.
- **Consumers MUST NOT infer containment from slug spelling.** Resolve `parent` against the vendored registry instead; slugs are opaque identifiers, and a hierarchy read out of a string is a hierarchy that breaks on the first entry that does not follow the pattern.

Groupings follow charter-industry convention rather than strict geography — a broker looking for "Western Mediterranean" expects the Balearics and the French Riviera in it, whichever way an atlas divides the sea. Names are unique across the whole list, at every level, so the fall-back-to-name rule stays unambiguous.

### Models

Models are deliberately **not** registered in v1: new models appear far too often for a central list to stay current, and a stale registry would train implementers to leave slugs null. Instead:

- A model exists **only in relation to a builder**: `vessel.model.slug` is builder-scoped (unique within that builder's namespace, meaningful only alongside `vessel.builder.slug`). Each authority curates its own model list.
- Cross-node matching relies on the builder anchor: once both sides agree on `builder.slug`, model names are a small, tractable comparison — and vessel matching on `builder + model + year_built + loa_m` already requires human confirmation per `yacht-identity.md`, never automation.
- If registry governance expands (v1.x), per-builder model lists can join `builders.json` entries without any wire change.

### Implementation guidance (non-normative)

Data entry for builders should be a fixed choice from the vendored registry plus an explicit "unlisted builder" escape hatch — not a free-text field. Normalising *dirty source data* is exclusively an import-connector concern (Phase 2): connectors map source strings to registry slugs using their own mapping, with one rule of thumb worth stating because it is easy to get wrong and expensive to discover late: **where a source offers both a constrained and a free-text field for the same concept, read the constrained one.** It is clean by construction; the free-text field beside it accumulates typing variants that then need normalising for no reason. A connector that reads the wrong one builds a large alias burden that was never necessary — and the mappings, once written, hide the mistake. Guard against generic placeholders (`Custom`, `Other`, `Unknown`) in the constrained field by falling back to the free-text value for those entries only. Names a connector cannot match are the natural curation queue for its own mapping, and the source of registry additions; canonical-name policy and casing rules are in [`../registry/README.md`](../registry/README.md).

## Complete example (sale)

```json
{
  "id": "https://authority.example/openyacht/v1/listings/018f6d2e-9f0a-7cc3-a1b2-3c4d5e6f7a8b",
  "type": "sale",
  "status": "active",
  "updated_at": "2026-08-19T16:05:00Z",
  "listed_at": "2026-02-04T15:06:12Z",
  "condition": "used",
  "agreement": { "type": "central", "co_brokerage": true },
  "vessel": {
    "hin": "OEOM5021G516",
    "imo": null,
    "mmsi": null,
    "official_number": "1261706",
    "builder": { "name": "Maritimo", "slug": "maritimo" },
    "model": { "name": "M50", "slug": null },
    "year_built": 2016,
    "refit_year": null,
    "loa_m": 15.24,
    "previous_names": []
  },
  "listing": {
    "name": "BLUE SKY",
    "summary": "BLUE SKY, the 50’ Maritimo, offers an unparalleled yachting experience…",
    "price": { "amount": "1388000", "currency": "USD", "on_application": false, "starting_price": false },
    "price_history": [
      { "amount": "1388000", "currency": "USD", "changed_at": "2025-05-15T17:37:01Z" },
      { "amount": "1450000", "currency": "USD", "changed_at": "2025-02-04T15:06:12Z" }
    ],
    "location": {
      "display": "Seattle, Washington, United States",
      "city": "Seattle", "state": "Washington", "country": "US",
      "marina": null, "coordinates": null
    },
    "brokers": [
      { "name": "Alex Marlow", "title": "Senior Broker", "email": "alex.marlow@authority.example", "phone": "+1 555 0100", "photo_url": null }
    ]
  },
  "specifications": {
    "beam_m": 5.05, "draft_max_m": 1.27, "draft_min_m": null,
    "lwl_m": null, "lod_m": null, "bridge_clearance_m": null,
    "gross_tonnage": null, "displacement_kg": null,
    "fuel_capacity_l": 3997.39, "water_capacity_l": 798.72, "holding_tank_l": 200.63,
    "cruise_speed_kn": 20, "max_speed_kn": 29, "range_nmi": null, "fuel_consumption_lph": null,
    "hull_material": "Fiberglass", "superstructure_material": null, "deck_material": null,
    "hull_shape": "planing", "hull_color": null,
    "naval_architect": null, "exterior_designer": null, "interior_designer": null,
    "fuel_type": "diesel", "flag": "United States", "registry_port": null,
    "power_or_sail": "power", "category": { "name": "Motor Yacht", "slug": "motor-yacht" },
    "cabins": 2, "sleeps": 4, "heads": 2, "guests_cruising": null, "guests_entertaining": null,
    "cabin_config": { "double": null, "twin": null, "triple": null, "single": null, "convertible": null },
    "berth_config": { "king": null, "queen": null, "double": null, "twin": null, "single": null, "pullman": null, "bunk": null },
    "crew_accommodation": { "cabins": null, "berths": null, "layout": null },
    "engines": [
      { "make": "Volvo", "model": "D11", "year": 2016, "type": "inboard", "drive_type": "Direct", "power_hp": 675, "power_kw": 503.35, "fuel_type": "diesel", "hours": 777, "hours_recorded_at": null, "location": "starboard" },
      { "make": "Volvo", "model": "D11", "year": 2016, "type": "inboard", "drive_type": "Direct", "power_hp": 675, "power_kw": 503.35, "fuel_type": "diesel", "hours": 777, "hours_recorded_at": null, "location": "port" }
    ],
    "generators": [
      { "make": "Onan", "model": null, "power_kw": 21, "hours": 550, "hours_recorded_at": null }
    ],
    "tenders": null
  },
  "descriptions": [
    { "section": "overview", "content": "<p>BLUE SKY, the 50’ Maritimo, is a well-maintained, extensively upgraded motor yacht…</p>" }
  ],
  "features": [
    { "category": "equipment", "name": "Water maker", "slug": "water-maker" },
    { "category": "comfort", "name": "Air conditioning", "slug": "air-conditioning" }
  ],
  "media": {
    "profile": { "url": "https://authority.example/media/listings/018f6d2e-9f0a-7cc3-a1b2-3c4d5e6f7a8b/profile.jpg", "sha256": "ef6d847c6ea6004cea1b1f1f9626c6ce4088442d63dde6e08fc404a822cf4c13", "width": 4000, "height": 2667, "caption": "Profile", "thumbnail_url": "https://authority.example/media/listings/018f6d2e-9f0a-7cc3-a1b2-3c4d5e6f7a8b/profile-thumb.jpg" },
    "gallery": [
      { "url": "https://authority.example/media/listings/018f6d2e-9f0a-7cc3-a1b2-3c4d5e6f7a8b/02.jpg", "sha256": "78a5b7b942ebaa3ffd8f54b695bda9619787b0ebd7ac7fffc29642e5d62a9695", "category": "exterior", "width": 4000, "height": 2667, "caption": "Aft deck", "sort": 1 }
    ],
    "layouts": [],
    "videos": [
      { "url": "https://www.youtube.com/watch?v=TRH6e_-jtVU", "sha256": null, "caption": "Video walkthrough", "sort": 1 }
    ],
    "tours": [],
    "documents": []
  },
  "charter": null,
  "usage": {
    "display": true,
    "attribution_required": true,
    "attribution_text": "Listing courtesy of Example Yacht Brokerage",
    "marketing_materials": true,
    "ai_indexing": true,
    "expires_with_listing": true
  },
  "compliance": {
    "not_for_sale_to_us_residents_in_us_waters": false,
    "vat_status": null,
    "ce_certified": null,
    "mca_compliant": null,
    "classification": []
  }
}
```

A charter listing differs only in `type`, `listing.price` (null), and a populated `charter` block as shown in *Charter*.

## Open questions (v0.1 → v0.2)

Five design decisions went out for industry consultation ([`../consultation/open-questions.md`](../consultation/open-questions.md) is the sendable document; responses collect privately and accepted changes land here as amendments carrying a consultation note). Status after the first consultation response (2026-08):

1. **Berth counts** — **resolved**: structured, as two linked schemas (`cabin_config` vs `berth_config`) plus a separate `crew_accommodation` block. Applied above.
2. **Media single-URL rule** — **resolved** (maintainer ruling from direct feed-integration experience, plus one confirming response): single large image per item, receiver resizes to its own needs; providers' pre-generated size sets never standardise across sources. One exception applied: `profile.thumbnail_url`, mandatory whenever imagery exists, for share/preview contexts; generated placeholder images are prohibited (`profile: null` is the only correct "no image").
3. **`vat_status` values** — **provisionally resolved as free text** with suggested tags; the closed enum remains open pending genuine VAT/sales-tax expertise.
4. **Charter crew personal data** — **resolved**: charter-manager/captain attestation replaces per-crew-member consent. Applied above.
5. **`agreement` block** — **open, with a counter-proposal on the table**: drop agreement details from the wire and carry only a self-attested "Central Agency on file" flag. Awaiting further responses before deciding.
