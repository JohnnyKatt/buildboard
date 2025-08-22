# Buildboard — Prototype Spec (master_prompt_v1_0)

## 0) Purpose
Build an MVP prototype for **Buildboard**, a platform where enthusiasts and shops document car builds, link parts, and (optionally) monetize via affiliate links, blueprint unlocks, and shop leads. Prioritize low-friction ingestion (invoices/photos/links) and a clean, mobile-first UX.

## 1) Users & Roles
- **Enthusiast**: documents personal builds; can share publicly, with friends, or keep private; can earn from affiliate links/blueprints.
- **Shop**: publishes builds they completed; gets attribution and qualified **Request This Build** leads.
- **Influencer/Admin-lite**: can publish builds and featured collections; light curation rights (optional for MVP).

## 2) MVP Scope (Do Now)
- Create/view **Build Profiles**
- **Part Linking** with multi-vendor support
- **Invoice Upload → AI Parse → Owner Confirm** (happy-path stub)
- **Shop Profiles** with attribution on builds
- **Privacy Controls**: Public / Friends-only / Private
- **Monetization Hooks**: affiliate-ready part chips; “Request This Build” lead form; gated blueprint (stubbed flow)

### Non‑Goals (Not in MVP)
- Payments/disbursements (mock only)
- Full comment threads/social graph
- Advanced analytics/dashboards
- Video parsing beyond a stub endpoint

## 3) Data Model (MVP)
- **User {id, role, display_name, email, avatar_url}**
- **Shop {id, name, location, bio, links, owners:[User.id]}**
- **Build {id, title, vehicle:{year, make, model, trim, vin?}, owner:User.id|Shop.id, visibility:{public|friends|private}, summary, media:[Media.id], parts:[Part.id], invoices:[Invoice.id], blueprint:Blueprint.id?, created_at}**
- **Part {id, name, brand, sku?, category, fitment_notes?, images:[Media.id]?, vendors:[VendorLink], confidence:{high|med|low}, verified_by:{count}, created_from:{invoice|manual|photo}}**
- **VendorLink {id, label, url, price_estimate?, availability?}**
- **Blueprint {id, build_id, gated_sections:[string], price?, preview_text}**
- **Invoice {id, build_id, source:{upload|link}, ocr_text, parsed_items:[{brand, name, sku?, price?}], status:{parsed|confirmed|rejected}}**
- **Media {id, type:{image|pdf|link}, url, caption?}**
- **Lead {id, build_id, shop_id, contact:{name,email}, message, status:{new|qualified|won|lost}}**

> Backward-compatibility rule: new fields must be optional or defaulted. Breaking changes require `schema_version` and migration note.

## 4) Core Workflows (Mechanics)

### 4.1 Build Creation (Enthusiast/Shop)
1) New Build → enter vehicle basics (year/make/model), add 3–5 photos.
2) Optional: upload invoice PDF/image OR paste a part link.
3) Save draft → gets a **Build Profile** with Parts section (empty or prefilled).

### 4.2 Invoice Ingestion (AI-assisted, stub)
- User uploads invoice(s) → system extracts candidate parts `{brand, name, sku?, price?}` and suggests mapping to **Part** records.
- UI shows a **Confirm Parts** checklist with confidence badges.
- On confirm, parts are added to the Build; each Part can hold **multiple VendorLinks**.

### 4.3 Part Linking (Manual + Multi‑Vendor)
- Minimal required fields: `{brand, part name}`; optional: `sku, fitment_notes`.
- Add 1..n **VendorLinks** (url + label); system attempts metadata fetch for title/price (stub ok).
- Pre-publish **Confirm** step shows confidence + preview; owner can toggle visibility of price.

### 4.4 Privacy & Gating
- Visibility at Build level: Public / Friends-only / Private.
- Gated Blueprint (stub): mark specific sections (e.g., offsets/sourcing) as gated with preview text.
- Time-gate toggle (stub): “release gated info after N days”.

### 4.5 Monetization Hooks (stubs allowed)
- **Affiliate-ready**: render vendor links as “shoppable chips” (just mark; no real network integration).
- **Blueprint unlock**: CTA triggers a mock purchase/confirmation modal; log an “unlock” event.
- **Request This Build** (Shop lead): form posts a **Lead** to the associated Shop.

## 5) Primary Screens
- **Home/Explore**: recent builds; filters by make/model; “verified” tags when parts confirmed by multiple builds (stub logic).
- **Build Profile**: hero (vehicle + photos), summary, Parts (chips with vendors), Timeline (invoices/media), owner/shop badge, CTAs (Follow—optional, Request This Build).
- **Add/Edit Build**: basics, media, Parts manager, Invoice upload/confirm.
- **Shop Profile**: about, builds, contact/lead form.
- **(Optional) Blueprint Preview**: shows ungated sections + lock state for gated bits.

## 6) UX Principles
- Mobile-first, 2–3 tap flows.
- Inline confirmations (no deep settings).
- Show **confidence** and **what needs confirmation** before publish.
- Respect privacy defaults; make “Public” an explicit choice.

## 7) Seed/Fixture Data (for demo)
Create 3 sample builds:
- **Shop build** (e.g., E46 M3): 8–10 parts, 2 invoices (parsed), verified_by≥2 (stub), vendors (3 per part).
- **Enthusiast build** (e.g., 911): 6–8 parts; 1 gated blueprint section (e.g., offsets).
- **Influencer build** (e.g., Civic): 5–7 parts; heavy vendor links; public.

Include 2 Shops with 2–3 builds each, and at least 1 **Lead** flow demo.

## 8) Tech/Output Expectations
- Generate a clickable prototype (web) with mock APIs for:
  - POST /invoices → returns parsed_items (stub data OK)
  - POST /leads → creates Lead
  - GET /parts?vendor=… (mock search)
- Provide minimal, readable components; no heavy styling beyond clarity.
- Include a short README panel inside the prototype explaining flows.

## 9) Guardrails & Constraints
- Keep scope to MVP features above.
- No real payments; treat earnings as mock counters.
- No auth complexity; role selection via simple switcher is fine for demo.

## 10) Success Criteria (for QA)
- Create → publish a Build with 3–5 photos in ≤ 2 minutes.
- Add 5+ Parts with multi-vendor links in ≤ 2 minutes.
- Upload invoice → see 3+ suggested parts → confirm to add.
- Toggle visibility and gated blueprint on at least 1 Build.
- Submit a “Request This Build” lead to a Shop and see it listed.

## 11) Version
- Spec: v1.0
- Notes: Initial MVP definition for emergent.sh

