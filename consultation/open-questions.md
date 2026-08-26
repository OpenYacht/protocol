# OpenYacht — Open Questions for Industry Review

**August 2026.** OpenYacht is an open protocol being drafted to let yacht brokerages hold their own listing data and share it directly with the co-brokerage partners they choose — one authoritative source per listing, live updates, licensed media, no central platform in the middle. The protocol defines a standard wire format for a yacht listing, and five design decisions in it need industry knowledge more than engineering judgment.

This document is self-contained — no other reading required. Each question gives context, the options, and our current working position. Disagreement with the working position is exactly what we're asking for; a sentence or two of reasoning per question is more valuable than a yes/no. Answer any subset — the note under each question says whose experience it needs most.

---

## 1. Cabin and berth breakdowns: structured data or free text?

*Best answered by: sales brokers, charter managers, anyone who fields "does it have a proper twin cabin?" enquiries.*

Listing systems disagree on how sleeping arrangements are described. Some feeds carry structured counts (2 king, 1 queen, 2 twin, 1 Pullman, convertibles); others carry only totals (7 cabins, sleeps 12) plus a free-text description. Charter systems tend to be structured; sale-side systems often aren't.

**Options:**
- **A. Structured berth counts** (king / queen / double / twin / single / Pullman / bunk / convertible, each optional) alongside the totals. Enables filtering ("needs two twin cabins") but adds fields many listings will leave empty.
- **B. Totals only** (cabins / sleeps / heads) plus free text. Simpler; loses filterability.

**Working position** (updated after early responses): A — structured, and modelled as **two linked breakdowns**, because cabin configuration and bed configuration are different facts: room types (double / twin / convertible — a convertible can be re-made) vs the sleeping surfaces they typically present as (4 double + 3 convertible cabins can present as 4 king + 3 queen, or 4 king + 6 twin). Plus a **separate crew accommodation block** (room count and bunk layout, not just a crew-berth number).

**What we need from you**: does this two-breakdown model match how you answer accommodation enquiries? Anything still missing?

---

## 2. Image delivery: one original per image, or pre-generated sizes?

*Best answered by: whoever runs a brokerage website or marketing operation.*

Every current feed we examined delivers each image in several pre-generated sizes (thumbnail / medium / large / high-res). Our draft instead sends **one URL per image — the best resolution the receiving partner is licensed for — plus a checksum**, and each receiving site generates its own display sizes. Cleaner protocol, verifiable files, but it means every consuming website needs basic image-processing capability (standard in modern web stacks, but not free).

**Options:**
- **A. Single URL + checksum** (current draft). Receivers derive their own sizes.
- **B. Optional pre-generated size variants** advertised alongside the original, for receivers that can't or won't process images.

**Status: resolved** (kept here for context). Decided for Option A by the maintainers from direct multi-feed integration experience — providers that ship multiple sizes never agree on a *standard* set, so multi-source consumers end up resizing anyway; a single large image resized to each receiver's needs (locally or via an on-the-fly image CDN) is the simpler contract. One exception adopted: a mandatory authority-served **profile thumbnail** for share cards and previews (and generated placeholder images are prohibited — "no image" must be detectable as such). *Amended 2026-08 on implementer feedback*: the thumbnail exception now also covers gallery and layout images — a nullable, authority-served small rendition per image, for consumers that must render previews before any import pipeline can run; the single-URL rule itself stands, and these thumbnails are the complete set of authority-served renditions. Object only if this would genuinely block you from consuming listings.

---

## 3. VAT / tax status: what states does a listing actually need?

*Best answered by: brokers who close cross-border sales, and anyone with EU/UK VAT experience. This is the question we are least qualified to answer ourselves.*

Feeds carry tax status loosely ("VAT Paid", free text, or nothing). Our draft proposes a fixed set of values: `paid`, `not_paid`, `exempt`, plus "unknown". But VAT status is a legally significant claim in a sale, and we suspect the real-world states are more nuanced (VAT paid but status lost through export? Temporary admission? Commercially registered / VAT reclaimable? US boats where the question is sales/use tax, not VAT?).

**Working position** (updated after early responses): free text for now, with `paid` / `not_paid` / `exempt` as *suggested* values only — a wrong fixed list would make every listing using it assert a legally meaningless claim, so no enforced list until someone with genuine EU/UK VAT and US sales/use-tax expertise signs one off.

**What we need from you**: that expert list — the distinct tax states a buyer's lawyer would care to distinguish at the *listing* stage (not the transaction stage), and which distinctions do NOT belong in a listing because they can only be established in due diligence.

---

## 4. Charter crew profiles: publishing people's data

*Best answered by: charter managers and anyone with GDPR/data-protection experience.*

Charter marketing runs on crew: names, roles, nationalities, bios, photos. Charter systems distribute all of this today. Our draft includes a crew section (with a "to be announced" option per position) and requires that crew data inherits the listing's usage terms — including automatic expiry when the listing ends — and that the operator has the crew member's consent to distribute it.

**Working position** (updated after early responses): include crew profiles, with automatic expiry when the listing ends — and instead of per-crew-member consent (which industry feedback says is not collectible at crew-turnover pace and was never the practice), the publishing operator provides an **attestation from the charter manager or captain that they are authorised to publish the crew data**.

**What we need from you**: does the attestation standard hold up in your operation? Does expiry-with-the-listing match how crew photos/bios should be handled when crew change mid-season? Anything a data-protection review would flag about attestation + expiry?

---

## 5. Listing agreement details: share them or keep them private?

*Best answered by: brokerage principals and senior brokers.*

The big feeds carry mandate metadata: central/exclusive/open agreement type, and whether co-brokerage is offered. It's commercially useful to a receiving broker (is this worth showing a client? can I co-broke it?). But it's also information about a private contract between the brokerage and the owner.

**Options:**
- **A. On the wire** (current draft): agreement type + co-brokerage flag, both optional.
- **B. Off the wire**: mandate details stay in the bilateral agreement between brokerages; the protocol carries only the listing itself.

**Working position**: was A; **now genuinely undecided, with a counter-proposal on the table** from an early respondent: share *neither* agreement type nor a co-brokerage flag — carry only a single **"Central Agency on file" yes/no**. Their reasoning: agreement type itself is usually known in the market, but normalising mandate metadata on the wire edges toward exposing timing (an exclusive nearing renewal is a poaching target), while a verified CA-on-file signal alone still delivers what the protocol needs — one authoritative source, de-duplication, and an answer to the length-inflation games seen on size-sorted platforms. One honest caveat from our side: with no central operator, "verified" can only mean *self-attested by the listing brokerage*.

**What we need from you**: reactions to the counter-proposal are as valuable as answers to the original question. Would a self-attested CA-on-file flag carry real weight with you? Do receiving brokers need the co-brokerage flag on the listing itself, or is that already implied by the fact a partner shared it with you? Is central/exclusive/open the right vocabulary internationally anyway?

---

*Replies are via **GitHub issues** on this repository — open one issue per question you answer, using the “Consultation response” issue form (it asks which question, your role, and your reasoning). Answer any subset. Thank you.*
