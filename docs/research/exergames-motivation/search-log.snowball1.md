### Citation searching (backward) — 2026-11-28
- Mode: snowball (backward), iteration 1
- Route: https://api.openalex.org/works/doi:<DOI>?select=id,referenced_works,referenced_works_count (keyless, HTTP 200 for all four seeds, references returned; Crossref fallback not needed). Each referenced work resolved via https://api.openalex.org/works/W...?select=... (keyless, no mailto; 187 unique lookups, all HTTP 200, no 429).
- Rule (protocol section 5): keep references with publication year >= 2024 whose title contains an exergame-block term or "serious game" (case-insensitive substring); if more than 15 remain, keep the 15 most recent. Per-seed cap 15; total cap 20 new records after dedup against records.csv (DOI, PMID, OpenAlex id, normalized title+year) and between seeds (first seed credited).
- Limits: backward only; no forward search was run.
- Cap: none hit (per-seed cap not reached by any seed; 6 new records of 20 total cap). All four seeds processed. NOT RUN: none.

| Seed | In reference list | Dated >= 2024 | Title term matched | Already in records.csv | Duplicate of earlier seed | Taken (new) |
|---|---|---|---|---|---|---|
| 1. pm-40567995 (W4411210357) | 26 | 0 | 0 | 0 | 0 | 0 |
| 2. pm-41307454 (W4416786710) | 68 | 14 | 4 | 1 (W4392373743 = oa-W4392373743) | 0 | 3 |
| 3. pm-41628428 (W7115745755) | 71 | 6 | 2 | 0 | 0 | 2 |
| 4. pm-43021294 (W7203637595) | 27 | 12 | 3 | 1 (W4411712717 = oa-W4411712717) | 1 (W4403263759, credited to pm-41307454) | 1 |

Taken, by seed (all by the "all matches, under cap of 15" rule, since matches never exceeded 15):
- pm-41307454: s1-oa-W4410002514, s1-oa-W4407781242, s1-oa-W4403263759
- pm-41628428: s1-oa-W4399730896, s1-oa-W4392652772
- pm-43021294: s1-oa-W4399814884

Total new records: 6. References total 192 across seeds (187 unique).
Notes: the title-term test is a plain substring match on the OpenAlex title; references without a title or year in OpenAlex would be excluded (none observed as an issue). Seed 1 (published 2025) cites nothing dated 2024 or later. Files: records.snowball1.csv, abstracts.snowball1.json.
