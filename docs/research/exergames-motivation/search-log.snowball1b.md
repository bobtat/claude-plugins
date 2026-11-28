### Citation searching (backward) — 2026-11-28 (extension of iteration 1, two further seeds)
- Mode: snowball (backward), iteration 1 (continuation of search-log.snowball1.md)
- Route: https://api.openalex.org/works/W7220097264?select=id,referenced_works,referenced_works_count (seed 1, no DOI) and https://api.openalex.org/works/doi:10.26603/001c.172561?select=... (seed 2, resolved to W7225011377). Keyless, no mailto, HTTP 200 both, references returned; Crossref fallback not needed. Referenced works resolved in batches of up to 50 via https://api.openalex.org/works?filter=openalex:<id|id|...>&select=... (keyless; all 31 and 32 references returned; no 429 or budget error).
- Rule (protocol section 5): keep references with publication year >= 2024 whose title contains an exergame-block term or "serious game" (case-insensitive substring); if more than 15 remain, keep the 15 most recent. Per-seed cap 15; cap for this part: at most 14 new records after dedup against records.csv (DOI, PMID, OpenAlex id, normalized title+year) and between seeds (first seed credited).
- Limits: backward only; no forward search was run.
- Cap: none hit (per-seed cap not reached; 4 new records of 14 available). Both seeds processed. NOT RUN: none.

| Seed | In reference list | Dated >= 2024 | Title term matched | Already in records.csv | Duplicate of earlier seed | Taken (new) |
|---|---|---|---|---|---|---|
| 1. oa-W7220097264 | 31 | 18 | 6 | 3 (W4410929396, W4407129649, W4392373743) | 0 | 3 |
| 2. pm-42974341 (W7225011377) | 32 | 2 | 1 | 0 | 0 | 1 |

Taken, by seed (all matches under the cap of 15):
- oa-W7220097264: s1-oa-W4411350775, s1-oa-W4403443509, s1-oa-W4401613739
- pm-42974341: s1-oa-W4405428558

Total new records in this part: 4 (earlier part 6; pass total 10 of 20). References total 63 across seeds.
Notes: title-term test is a plain substring match on the OpenAlex title. None of the four taken records is in records.snowball1.csv. Taken record s1-oa-W4401613739 has no abstract in OpenAlex (no key in abstracts.snowball1b.json). Files: records.snowball1b.csv, abstracts.snowball1b.json.
