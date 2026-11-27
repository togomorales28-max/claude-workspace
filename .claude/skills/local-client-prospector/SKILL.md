---
name: local-client-prospector
description: Use this skill to find and qualify local business prospects anywhere in the world — any geography (city, town, neighborhood, ZIP/postal code, GPS coordinates, landmark) and any business category (shops, gyms, restaurants, clinics, salons, professional services, B2B, trades, e-commerce-eligible, etc.). Uses WebSearch and WebFetch for assisted research, checks whether each business has a real standalone website or only social profiles, scores the opportunity (Hot/Warm/Low/Skip) and returns a concise lead sheet in chat, CSV rows, or a file. Triggers on phrases like "find local clients", "prospect nearby businesses", "find businesses that need a website", "lead generation near <area>", "trova clienti locali", "encontrar clientes locales", "find <category> in <place>", or `/local-client-prospector`.
---

# Local Client Prospector

Use this skill when the user wants to discover local businesses — anywhere in the world, in any category — that could become website, digital-marketing, automation, or service clients.

The skill is **geography-agnostic** and **category-agnostic**. It works equally well for "plumbers in Boise, Idaho" and "centri estetici a Casoria" and "boutique hotels in Lisbon" and "law firms within 50 km of Singapore CBD".

Default output is a compact lead sheet in chat. Create a CSV or spreadsheet only when the user asks for a file or when the result set is too large for chat.

## Inputs to Collect

If missing, infer reasonable defaults and continue. Ask one concise clarification only if the location cannot be inferred at all.

- `base_location` — required. Accepts:
  - city/town/neighborhood name (`Casoria`, `Brooklyn`, `Shibuya`)
  - full address (`123 Main St, Austin TX`)
  - postal/ZIP code (`10001`, `80138`, `SW1A 1AA`)
  - landmark / venue (`near Termini station`, `Gym Exclusive Casoria`)
  - GPS coordinates (`40.6,14.3`)
  - region/country (`Andalusia`, `Bavaria`, `Lombardy`) — use a wider radius
- `radius_km` — default `20`. If the location is a city neighborhood, default to `5`. If it's a region/country, default to `50`+ and warn the user that results will be a sample.
- `categories` — default `shops, gyms, restaurants, hair salons, beauty salons, professional studios`. Translate to the local language when querying (Italian: `negozi, palestre, ristoranti, parrucchieri, estetisti, studi professionali`; Spanish: `tiendas, gimnasios, restaurantes, peluquerías, esteticistas, despachos profesionales`; etc.). Categories are **open-ended** — accept any business type the user names (B2B SaaS resellers, dentists, auto repair, real estate agencies, vape shops, food trucks, kindergartens, wedding planners, etc.).
- `max_leads` — default `15`.
- `language` — match the user's prompt language for output; query in the local language of the target area.
- `output` — default `chat table`; alternatives: `CSV rows`, `.csv file`, `.xlsx file`, `JSON`.
- `prospect_angle` — optional. Default angle is "needs a website / has weak online presence." Other angles the user might supply:
  - "needs SEO / GEO" (has a site but invisible in search)
  - "needs Google Business Profile setup"
  - "needs e-commerce / online booking"
  - "needs reputation management" (mixed/bad reviews)
  - "needs paid ads"
  - "needs CRM / automation"
  - "B2B procurement target for <product>"

Adapt the verification workflow and scoring rubric to whichever angle the user picks.

## Compliance Guardrails

- Use WebSearch and WebFetch as assisted research tools, not as a bulk scraper.
- Do not attempt to bypass CAPTCHAs, login walls, rate limits, bot protections, or paywalls. If a fetch is blocked, fall back to a different public source.
- Do not extract or resell Google Maps data at scale. Prefer the business's own site, official directory listings (country-specific: Pagine Gialle, Yelp, TripAdvisor, Yell, Páginas Amarillas, 黄页, Justdial, etc.), and public social pages.
- Prefer public business facts and official business contact channels.
- Respect local privacy law (GDPR in EU/UK, CCPA in California, LGPD in Brazil, PIPL in China, APPI in Japan, etc.). Avoid collecting personal emails or private personal data unless the source is clearly public business contact info.
- Cross-check important details (phone, address, website) with at least one independent public source before marking high confidence.

## Research Workflow

### Step 1 — Pick the right discovery sources for the country

Different countries have different dominant directories. Adapt queries to the locale:

| Region | Strong directory sources |
| --- | --- |
| US / Canada | Yelp, Google Business listings, BBB, Yellow Pages, Nextdoor, Angi |
| UK / Ireland | Yell, Thomson Local, Trustpilot, Checkatrade |
| Italy | Pagine Gialle, Pagine Bianche, TripAdvisor, Cylex |
| Spain / LATAM | Páginas Amarillas, El Tenedor, Cylex |
| France | Pages Jaunes, La Fourchette, Société.com |
| Germany / Austria / CH | Gelbe Seiten, Das Örtliche, Yelp |
| Brazil | Apontador, ReclameAQUI, GuiaMais |
| India | Justdial, Sulekha, IndiaMart |
| Japan | Tabelog, Hotpepper, iタウンページ |
| China (where accessible) | Dianping, Baidu Maps listings |
| MENA | Yellow Pages MENA, Zomato, Talabat (food), property portals |
| Global fallback | Yelp, TripAdvisor, OpenStreetMap business POIs, Trustpilot |

### Step 2 — Discover candidates

Run WebSearch with queries adapted to the locale:

- `<category> near <base_location>` (English)
- `<category> <city> site:<local-directory>`
- For neighborhoods: `<category> <neighborhood> <city>`
- For B2B angles: `<industry> companies <region>`, `<industry> directory <country>`

Pull candidate names from search snippets, directory result pages, and review-site listings.

### Step 3 — Verify each candidate

For each business, run a focused query: `"<exact business name>" <city>`. Then WebFetch the most authoritative result to extract phone, address, hours, and a working contact URL.

### Step 4 — Classify website status

- `No site found` — no credible standalone website after cross-check.
- `Social only` — only Facebook, Instagram, WhatsApp Business, Linktree, booking portal (Fresha, Treatwell, MioDottore, etc.), or marketplace page (Etsy, Amazon storefront, Just Eat, Deliveroo, etc.).
- `Weak site` — standalone site exists but: outdated design, broken pages, very thin content, non-mobile-friendly, expired SSL, missing clear contact/conversion flow, or no GMB linkage.
- `Has site` — credible, current standalone website.

### Step 5 — Mark confidence

- `High` — confirmed by ≥2 independent sources or the business's own official page.
- `Medium` — one credible source plus consistent search evidence.
- `Low` — incomplete or ambiguous evidence; state explicitly what's missing.

### Parallel verification

When the candidate list is long (≥10) and the user asks for thorough verification, dispatch verification in parallel using the `Agent` tool (`subagent_type: "Explore"` or `general-purpose`). Split candidates into non-overlapping batches of 3–5; each subagent verifies only website/social/contact status and returns a structured row per business. Do not parallelize the initial discovery search.

## Lead Scoring

Default angle (needs a website / digital presence):

| Score | Criteria |
| --- | --- |
| `Hot` | No site found OR social only, phone/contact present, active business, inside target radius. |
| `Warm` | Weak site, poor online presentation, or marketplace/booking page only. |
| `Low` | Good website already present, or confidence is low. |
| `Skip` | Closed, duplicate, outside radius, irrelevant category, or not a real business prospect. |

When the user picks a different `prospect_angle`, re-derive the rubric. Examples:

- **Needs SEO** → `Hot` = has site but doesn't rank for primary category in first 2 result pages; `Warm` = ranks but no GMB / poor metadata; `Low` = already optimized.
- **Needs e-commerce** → `Hot` = sells physical product, no online ordering; `Warm` = uses only DM/WhatsApp orders; `Low` = has working e-commerce.
- **Needs reputation mgmt** → `Hot` = ≥10 reviews and average <3.5★, or unanswered negative reviews; `Warm` = mixed reviews with no public responses; `Low` = ≥4.5★ with active engagement.

## Output Format

### Chat table (default)

```markdown
| Score | Business | Category | Area | Distance | Website status | Website/Social | Phone | Why prospect | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

Rules:
- Keep `Why prospect` short and actionable (e.g. "Only Facebook page, 4.7★ with 200 reviews — strong demand, no funnel").
- Use `Not found` instead of leaving a field blank.
- Include 1–2 source links per row at most. Put longer URL lists in a footnote.
- After the table add a `### Best first outreach targets` section with the top 3 leads and one practical reason each.
- If any row's confidence is `Low`, state exactly what remains uncertain.
- Always include search parameters at the bottom: location, radius, categories, prospect angle, date.

### CSV rows / file

When the user asks for CSV-style rows or a file, use these columns (see `assets/lead-template.csv`):

```csv
score,business,category,area,country,distance_km,website_status,website_url,social_urls,phone,email,source_urls,why_prospect,confidence,prospect_angle,notes
```

For `.xlsx`, write the CSV first then convert via `openpyxl` or `pandas.to_excel`. If a spreadsheet skill is available, hand off the CSV and let that skill produce the workbook with filters and conditional formatting on the `score` column (Hot=red, Warm=orange, Low=grey).

## Quality Checks

Before finalizing the response:

- Remove duplicates (same business listed under variant names or alternate-language spellings).
- Do not label a lead `Hot` if you found a credible standalone website (unless the prospect angle isn't "needs a website").
- Do not claim a site is missing unless you actually ran an exact-name web search.
- Prefer fewer verified leads over many weak guesses — 8 strong `Hot/Warm` rows beat 20 unverified ones.
- Respond in the same language as the user's prompt; localize category names to the target area when searching.
- Include the search location, radius, categories, prospect angle, and today's date in the final response so the lead sheet is self-documenting.
