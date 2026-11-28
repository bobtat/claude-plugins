# Search log

Protocol approved 2026-11-28 (gate 1, user). All searches below ran after approval.

## Pass 0 — database search, 2026-11-28

| Source | query_id | Total matched | Retrieved | Cap hit |
|---|---|---|---|---|
| PubMed | pm-1 | 83 | 83 | no cap |
| OpenAlex (keyless) | oa-1 | 106 | 106 | no cap |

### PubMed — 2026-11-28
- Mode: search, iteration 0 (query_id pm-1, source_type database)
- Route: NCBI E-utilities (no key): esearch.fcgi (db=pubmed, retmax=10000), esummary.fcgi, efetch.fcgi (rettype=abstract, retmode=xml)
- String: `(exergam*[tiab] OR "exer-gam*"[tiab] OR "active video gam*"[tiab] OR "active videogam*"[tiab] OR "exercise video gam*"[tiab] OR "exercise videogam*"[tiab] OR "active gaming"[tiab] OR "fitness gam*"[tiab] OR "interactive video gam*"[tiab] OR "motion-based gam*"[tiab] OR "motion-controlled gam*"[tiab] OR "movement-based gam*"[tiab] OR "exertion game*"[tiab] OR "dance game*"[tiab] OR "location-based game*"[tiab] OR "game-based exercise"[tiab] OR "game-based training"[tiab] OR "game-based rehabilitation"[tiab] OR "video game-based"[tiab] OR "gamified exercise"[tiab] OR "virtual reality exercise"[tiab] OR "virtual reality-based exercise"[tiab] OR "VR exercise"[tiab] OR "virtual reality game*"[tiab] OR "VR game*"[tiab] OR "Ring Fit"[tiab] OR "Nintendo Switch"[tiab] OR "Kinect"[tiab] OR "Wii"[tiab] OR Xbox[tiab] OR "EyeToy"[tiab] OR "Just Dance"[tiab] OR "Dance Dance Revolution"[tiab] OR "Beat Saber"[tiab] OR "Exergaming"[MeSH]) AND (motivat*[tiab] OR amotivation[tiab] OR motive*[tiab] OR "self-determination"[tiab] OR "self-determined"[tiab] OR "basic psychological need*"[tiab] OR "need satisfaction"[tiab] OR "behavioral regulation"[tiab] OR "behavioural regulation"[tiab] OR "autonomous regulation"[tiab] OR BREQ[tiab] OR "Motivation"[MeSH]) AND (randomized controlled trial[pt] OR randomi*[tiab] OR randomly[tiab] OR RCT[tiab]) AND 2024/01/01:2026/11/28[dp]`
- Limits: date only (2024/01/01:2026/11/28[dp]); no language or publication-type limit
- Total matched: 83 (esearchresult.count)
- Retrieved: 83 (unique PMIDs)
- Overlap with this source's other strings: n/a (single string)
- Cap: none (retrieved = total matched)
- Abstracts: 83 with, 0 without
- DOI: 83 with, 0 without
- Notes: String read verbatim from protocol.md section 4 and sent URL-encoded via curl --data-urlencode, unmodified. No warnings: phrasesignored and quotedphrasesnotfound empty. PubMed's querytranslation rewrote "exer-gam*" as "exer gam*" (hyphen handled by the parser); the string submitted was unchanged. Dates are publication dates per [dp]; year column is the first four characters of esummary pubdate.
### OpenAlex - 2026-11-28
- Mode: search, iteration 0 (query_id oa-1)
- Route: https://api.openalex.org/works?filter=<value>&per-page=200&cursor=* (REST, filter route, cursor paging; 1 page)
- Key: none (keyless, as authorised by protocol section 12 and the gate-1 decision). No mailto sent. No 429 or budget error occurred.
- String (filter value, verbatim from protocol.md section 4):
```
title_and_abstract.search:(exergame OR exergames OR exergaming OR "exer-game" OR "exer-games" OR "exer-gaming" OR "active video game" OR "active video games" OR "active video gaming" OR "active videogame" OR "active videogames" OR "exercise video game" OR "exercise video games" OR "exercise videogame" OR "exercise videogames" OR "active gaming" OR "fitness game" OR "fitness games" OR "interactive video game" OR "interactive video games" OR "motion-based game" OR "motion-based games" OR "motion-controlled game" OR "motion-controlled games" OR "movement-based game" OR "movement-based games" OR "exertion game" OR "exertion games" OR "dance game" OR "dance games" OR "location-based game" OR "location-based games" OR "game-based exercise" OR "game-based training" OR "game-based rehabilitation" OR "video game-based" OR "gamified exercise" OR "virtual reality exercise" OR "virtual reality-based exercise" OR "VR exercise" OR "virtual reality game" OR "virtual reality games" OR "VR game" OR "VR games" OR "Ring Fit" OR "Nintendo Switch" OR Kinect OR Wii OR Xbox OR EyeToy OR "Just Dance" OR "Dance Dance Revolution" OR "Beat Saber") AND (motivation OR motivational OR motivated OR amotivation OR motive OR motives OR "self-determination" OR "self-determined" OR "basic psychological needs" OR "need satisfaction" OR "behavioral regulation" OR "behavioural regulation" OR "autonomous regulation" OR BREQ) AND (randomized OR randomised OR randomly OR RCT),from_publication_date:2024-01-01,to_publication_date:2026-11-28,type:article
```
- Limits: publication date 2024-01-01 to 2026-11-28, type:article, no language limit
- Total matched: 106 (meta.count)
- Retrieved: 106 (106 unique record_ids)
- Retrieved with abstract: 93; without abstract: 13
- Retrieved with DOI: 102; without DOI: 4; with PMID: 54
- Overlap with this source's other strings: n/a (single string)
- Cap: none (all 106 of 106 retrieved)
- Notes: The API's own query echo (meta.x_query) shows the filter was parsed as three AND-ed title_and_abstract.search groups, with multi-word phrases and many single terms marked "stemmed", so OpenAlex applied stemming despite the protocol's note that it has no truncation; plural/variant matching may therefore be broader than the written string. Default order is best match. Abstracts rebuilt from abstract_inverted_index. Side metadata in openalex-extra.json.

### Deduplication, 2026-11-28

Matched in order: DOI, PMID, normalized title + year. 189 records retrieved; 49 marked
`duplicate` (all 49 OpenAlex records matching a PubMed record by DOI; the PubMed row is
kept and carries the OpenAlex ID and both query IDs). **140 kept**: 83 PubMed, 57
OpenAlex only.

- One title match was **not** collapsed: `pm-40321768` (Research Square preprint, DOI
  10.21203/rs.3.rs-5702495/v1) and `pm-40682190` (its published version, DOI
  10.1186/s12984-025-01667-z) are two reports of one study and both are kept, to be
  linked under one `study_id` at screening.
- 7 kept records (all OpenAlex-only) have no abstract and are screened on title alone.
- 140 is under the protocol's stop threshold of 160 (section 5), so screening proceeds.
  The citation-searching total cap is therefore min(40, 160 − 140) = **20** new records.

### Note on OpenAlex stemming

The OpenAlex API's echo of the parsed query marks terms as stemmed. Protocol section 4
says OpenAlex "has no truncation"; that is true of wildcard syntax, but the source
applies stemming of its own, so plural and variant matching may be somewhat broader
than the written string. The string was run as approved and was not changed. This is a
property of the interface, recorded here and reported in the review; the count (106)
equals the pilot count.

## Pass 1 — backward citation searching, 2026-11-28

Seeds: the three reports both screeners included at full text (pm-40567995, pm-41307454, pm-43021294) and pm-41628428, whose inclusion the adjudicator escalated to the user and which is undecided until gate 2. It was used as a seed so that no pass would have to be re-run if the user includes it; the 2 records it contributed are marked by `query_id=bw-pm-41628428` and are named at gate 2.

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

Forward citation searching: **not run** (protocol section 5: backward only). Iterations: one, the protocol cap; records found in this pass are not seeds.

## Screening volume projection, 2026-11-28

First pilot (20 records): 2 advanced, projecting 14 full texts against the protocol estimate of 55-75. Both screeners doubted E5 on the same records, so amendment A1 was made and the pilot re-run: 7 of 20 advanced, projecting about 49. That is under the estimate, so the full run proceeded. Actual: 60 of 140 advanced.

## Full-text retrieval, 2026-11-28

62 reports sought (60 database, 2 citation searching). 27 retrieved, all from Europe PMC open-access XML and all title-checked. 35 not retrieved: 11 PubMed records with no open-access PubMed Central text; 21 OpenAlex-only records with a DOI and no Europe PMC record; 3 OpenAlex-only records with no DOI. No other route was tried (protocol: PubMed Central and arXiv only). Per record: `retrieval.csv`.
