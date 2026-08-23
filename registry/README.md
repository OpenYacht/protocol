# OpenYacht Shared Vocabulary Registry

`builders.json` is the fixed builder vocabulary for the OpenYacht protocol, `categories.json` the fixed category vocabulary, and `destinations.json` the fixed charter-destination vocabulary. (`features.json` is different in kind — a **non-normative** well-known list, never a validation gate; the rules in this file up to its own section below do not apply to it.) Normative rules for how nodes use them are in [`../spec/listing-schema.md`](../spec/listing-schema.md) (*Shared vocabulary*). This file covers maintenance; the builder-specific curation rules below do not apply to categories, which are a small, near-closed list (entries `{ "slug", "name" }`). Category names are **singular** ("Motor Yacht", never "Motor Yachts"), and category slugs never encode the `power_or_sail` axis — power vs sail is a separate wire field, so there is one `catamaran`, not a power/sail pair. Additions should be argued from real inventory that no existing category fits.

**Format**: `{ "slug", "name", "country" }` per builder. `slug` is permanent once published — renames are done by changing `name`, never `slug`. The registry is deliberately **alias-free**: it is the fixed validation list both sides of a federation exchange check builder slugs against. Alias/variation mappings for normalising dirty *feed* data are an import concern, not registry data: each implementer maintains its own for the sources it reads.

**Versioning**: date-based (`2026.08.0`), tzdata-style, bumped on every published change. Canonical publication URLs: `https://openyacht.org/registry/{builders,categories,destinations}.json`. Nodes vendor a copy; a registry is never fetched at request time.

**Governance**: pull requests to this repository.

## Deciding the canonical name

The canonical `name` is **the name a buyer would search**. The rules:

- **Corporate parent → split into brands.** Excess is Groupe Beneteau's catamaran brand → `Excess`, not folded into `Beneteau` (like Lagoon).
- **Shipyard → collapse into the brand.** Overmarine Group builds Mangusta → `Mangusta`. CRN yard builds Custom Line boats → those listings are `Custom Line`.
- **Regional arm → merge into the parent brand.** "Beneteau America", "Beneteau (usa)" → `Beneteau`. Buyers don't care which factory laid the hull.
- When unsure, check actual boats: the model field usually disambiguates (Mangusta yachts have model "Mangusta 165").

**Casing**: keep intentional mixed case (`SeaVee`, `AB Inflatables`, `HH Catamarans`) and short all-caps acronym brands (`CRN`, `MJM`, `HCB`) verbatim; only title-case strings that arrive entirely upper- or lowercase.

**Do not merge on string similarity alone.** Suffix pairs are sometimes genuinely different companies (`Admiral` the Italian superyacht builder vs `Admiral Marine` the Port Townsend yard; `Silver` vs `Silver Yachts`). Every merge is a judgment call by someone who knows the yards.

## Curation queues

- The builder list covers the great majority of active on-market inventory by name, not every builder that has ever existed. A long tail of one-off and historic yards is deliberately left for case-by-case curation: an entry earns its place when a real listing needs it.
- Standing curation queue for missing registry entries: the broker-typed brand strings that accumulate in import sources, and — cleaner — the distinct values of a source's constrained field. Generic placeholders (`Custom`, `Custom Built`, `Other`, `Unknown`) are never registry entries.
- `country` is `null` where not yet curated; filling these is welcome PR material.
- **Destinations** carry `{ "slug", "name", "parent" }` and form a hierarchy; `parent` is another entry's slug or `null` for a top-level region. Names are unique across the whole list at every level, because consumers fall back to the name when a slug is unknown. Groupings follow charter-industry convention rather than strict geography — the test for a new entry is whether brokers actually market that cruising ground as a unit, not whether an atlas draws the line there. Adding a sub-area is cheap; renaming or re-parenting a published one is not, since slugs are permanent.

## The features list (`features.json`) — non-normative

`features.json` is the well-known feature slug list referenced by [`../spec/listing-schema.md`](../spec/listing-schema.md) §Features. Unlike the three vocabularies above it is **non-normative**: it is never a validation gate on either side of an exchange. A feature's `name` is free text on the wire and always display truth; a slug is sent only when the feature matches an entry here, and an unmatched feature is sent with `slug: null`. An unknown slug is never an error — this list exists so that common features interoperate, not to constrain what a feature can be. Promotion to a builders-style fixed registry is a v1.x decision the spec reserves.

- **Format**: `{ "slug", "name", "category" }` per entry. `category` is this file's own grouping label for curation and display, **not an enum**: the `category` an authority sends on the wire is its own label and need not match this file.
- **Most-specific entry wins.** Where entries overlap in specificity (`stabilizers-anchor` over `stabilizers`, `hydraulic-swim-platform` over `swim-platform`), authorities should send the most specific entry that is true — never both.
- **Names are unique** (consumers fall back to them) and are the term a buyer would search, including genericised brand names where that is the industry word (`Seabob`, `Jet Ski`, `Starlink`).
- **Spelling**: registry data values use American spelling (`stabilizers`, `snorkeling`) — the convention of the predominant buyer market. Spec prose keeps British spelling; the two coexist deliberately.
- **Versioning and governance** follow the other registries: date-based version bumped on every published change, canonical URL `https://openyacht.org/registry/features.json`, vendored by nodes and never fetched at request time, slugs permanent once published, additions via pull request argued from real listings.
