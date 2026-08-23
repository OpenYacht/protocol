# Contributing

Governance is pull requests to this repository. There is no committee and no
runtime service — the spec, the schemas, and the registry all change the same
way: a PR, review, merge.

## Amendments to the draft spec

Everything here is **Draft v0.1** and stays at v0.1 until the public-release
review completes. Changes are made by amending the documents in place:

- Every substantive change carries an **inline note citing its source and
  date** — e.g. *(industry consultation, 2026-08: …)* or *(clarified after
  implementer feedback, 2026-08)*. This is the amendment convention; it keeps
  the drafts honest about what changed and why without version churn.
- Consultation responses come in as **GitHub issues** using the
  "Consultation response" issue form (one issue per question answered).
  Responses received privately from existing contacts are not republished.
  Changes accepted from either route land as PRs carrying the consultation
  note; the note summarises the reasoning, not the respondent's text, and
  names the respondent only with their permission.
- Open questions are marked ⚠ inline and collected in
  `consultation/open-questions.md`. A PR that resolves one updates both.

## Issues

Please use the issue forms — they exist to keep signal high:

- **Consultation response** — answering one of the open questions.
- **Spec feedback** — an error, ambiguity, or conflict in the spec, schemas,
  or OpenAPI document.
- **Builder registry request** — a missing builder or a correction, for
  those not comfortable opening a PR directly.
- **Node directory listing** — listing, delisting, or amending your node in
  the node directory (`registry/nodes.json`), by signed request from the
  node operator — see the *Get listed* walkthrough in `registry/README.md`.

Blank issues are disabled. Marketing, listing submissions, and support
requests for specific implementations are out of scope and will be closed.

## Prose vs schemas

The prose spec is normative; schemas are normative for JSON shape only. **A PR
that changes payload shape must change the prose, the schema, and the
examples together** — CI enforces consistency:

- every file in `examples/valid/` must validate against its schema;
- every file in `examples/invalid/` must fail (each is named for its one
  deliberate defect);
- the complete example in `spec/listing-schema.md` is byte-identical to
  `examples/valid/sale-full.json`;
- the OpenAPI document must lint and all `$ref`s must resolve;
- no link may point at a private-repo path.

If you find a conflict between prose and schema, the schema is defective:
file an issue or a PR fixing the schema. Never fork a schema to match an
implementation.

## Registry PRs (`registry/builders.json`)

The builder registry is the fixed vocabulary both sides of an exchange
validate slugs against. Rules for additions and changes:

- **Slugs are permanent.** Renames change `name`, never `slug`. Removals are
  not made; a defunct builder stays (existing listings reference it).
- One builder per PR is easiest to review; batches are fine when they share a
  rationale.
- Follow the canonical-name policy in `registry/README.md` — the name a buyer
  would search: brands split from corporate parents, shipyards collapsed into
  brands, regional arms merged into the parent. Do not merge on string
  similarity alone; suffix pairs are sometimes genuinely different companies.
- Casing: keep intentional mixed case and acronym brands verbatim; only
  title-case strings that arrive entirely upper- or lowercase.
- Filling in `country: null` on existing entries is welcome PR material.
- Every merged change bumps the date-based version (`2026.08.0` →
  `2026.08.1`, tzdata-style).

Generic placeholders (`Custom`, `Custom Built`, `Other`, `Unknown`) are never
registry entries. A genuinely unlisted builder goes on the wire as
`{ "name": "…", "slug": null }` — the remedy is a registry PR, not an
invented slug.

## Running the checks locally

```
npm ci
npm test
```

`npm test` runs everything CI runs: schema validation of all examples, the
prose↔example lock, the registry checks, the link check, and the OpenAPI lint.

## Licensing of contributions

By contributing you agree your contribution is licensed under the license
covering the files you touch: CC-BY-4.0 for prose, MIT for schemas, examples,
the registry, and tooling (see `LICENSE`).
