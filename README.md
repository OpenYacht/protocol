# OpenYacht Protocol

**OpenYacht is an open protocol for yacht brokerages to hold their own listing
data and share it directly with the co-brokerage partners they choose** — one
authoritative source per listing, live updates, licensed media, machine-readable
usage terms, and no central platform in the middle.

Each participating system ("node") is identified by its domain, publishes its
keys at a well-known URL, and signs every federation request. Trust is pairwise
and human-approved. There is deliberately nothing in the middle: no gatekeeper
to register with, no operator who can raise API prices, no platform the
industry's data accumulates inside. Two brokerages exchanging listings over OpenYacht
depend on each other and on nothing else — and get value from the first
connection: live inventory, correct prices, licensed images, machine-readable
usage terms.

## Status: Draft v0.1

**These documents are published as drafts, for review.** Two independent systems
exchange listings over this protocol today — a production node and a separate
reference implementation — and the drafts are published so the industry can
review them while they are still cheap to change.

- **Versioning**: everything here is Draft v0.1. There will be no version bump
  until the public-release review completes; accepted changes land as pull
  requests amending the drafts in place, each carrying a note citing its
  source and date (see `CONTRIBUTING.md`).
- **Open questions**: five design decisions went out for industry consultation
  (`consultation/open-questions.md`). Four are resolved or provisionally
  resolved; **question 5 — whether listing-agreement details belong on the
  wire at all — is genuinely open**, with a counter-proposal on the table.
  The spec marks open questions ⚠ inline. To respond, open a GitHub issue
  with the "Consultation response" form.

## What's in this repository

| Path | Contents |
|---|---|
| `spec/` | The protocol: six documents, listed in reading order below |
| `schemas/v1/` | JSON Schemas (2020-12) for every wire payload |
| `openapi/` | OpenAPI 3.1 description of the federation API |
| `registry/` | The shared builder vocabulary (`builders.json`) |
| `examples/` | Example payloads — `valid/` must validate, `invalid/` must fail |
| `consultation/` | The open-questions document sent for industry review |

## Reading order

1. [`spec/federation-protocol.md`](spec/federation-protocol.md) — identity,
   trust, keys, discovery, request signing. Start here.
2. [`spec/yacht-identity.md`](spec/yacht-identity.md) — who owns a record:
   canonical URIs, authority, copies, provenance, usage terms.
3. [`spec/api-design.md`](spec/api-design.md) — endpoints, sync
   (`updated_since` + tombstones), subscriptions, errors.
4. [`spec/listing-schema.md`](spec/listing-schema.md) — the field-by-field
   wire payload of a listing.
5. [`spec/conformance-checklist.md`](spec/conformance-checklist.md) — every
   MUST, collected into one self-certification sheet.
6. [`spec/signing-test-vectors.md`](spec/signing-test-vectors.md) — byte-exact
   test vectors for the request signing.

The spec is written to be handed to a dev team cold: a competent team should be
able to add a compliant endpoint to an existing in-house system in days,
without adopting anyone's stack.

## Prose vs schemas: which is normative

The prose specification is normative. The JSON Schemas in `schemas/v1/` and
the OpenAPI document are normative **for JSON shape only** — field names,
types, required-ness, enum values, string formats. Semantics the schemas
cannot express (builder-slug registry membership, field-group gating, the
24-hour update obligation, HTML sanitisation, request signing) remain prose +
conformance checklist. **On any conflict between prose and schema, the prose
wins and the schema is defective — fix the schema, never fork it.**

Schemas are published at permanent URLs under
`https://openyacht.org/schemas/v1/` and are meant to be **vendored** by
implementers — like the builder registry, they are never fetched at request
time.

## Scope boundaries (v1)

- **In scope**: sale listings, charter listings (static data: yacht, rates,
  capacities), partner management, sync, media, usage terms.
- **Out of scope for v1**: charter availability calendars and booking flows;
  listing relay through intermediary nodes; partner discovery (connecting two
  nodes today means exchanging domains — brokers already know who they
  co-broker with). A discovery layer that helps nodes find each other across
  the network is planned for a later version; whatever shape it takes, it
  will be optional and advisory — a node never needs to be listed anywhere
  to federate.

## Contributing

Governance is pull requests to this repository — see
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the amendment convention, the
consultation-note convention, and the registry PR rules. Licensing:
spec text CC-BY-4.0, machine-readable artifacts MIT — see [`LICENSE`](LICENSE).
