## Citation verification — review.md (exergames-motivation), 2026-11-28

Independent run. No earlier verification report was consulted. Routes: Crossref (DOI), PubMed esummary (PMID, used as a second route for the five trials), OpenAlex works API plus the publisher page's `citation_*` meta tags (the one entry with no DOI). No request failed, and TLS verification stayed on.

### Per-reference table

| # | Key | Cited as (implied by key and tables) | Identifier | Resolves to | Verdict |
|---|---|---|---|---|---|
| 1 | page2021prisma | Page et al. 2021, PRISMA 2020 | 10.1136/bmj.n71 | "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews", Page, BMJ, 2021-03-29 | ✅ match |
| 2 | campbell2020synthesis | Campbell et al. 2020, SWiM | 10.1136/bmj.l6890 | "Synthesis without meta-analysis (SWiM) in systematic reviews: reporting guideline", Campbell, BMJ, 2020-01-16 | ✅ match |
| 3 | sterne2019rob | Sterne et al. 2019, RoB 2 | 10.1136/bmj.l4898 | "RoB 2: a revised tool for assessing risk of bias in randomised trials", Sterne, BMJ, 2019-08-28 | ✅ match |
| 4 | nikolova2025effect | Nikolova et al. 2025 (study `oa-W7220097264`) | none (OpenAlex W7220097264, publisher page article/view/20) | OpenAlex and the publisher page both give "Effect of a VR Exergame Intervention on Exercise Motivation and Self-Efficacy", Nikolova, Adeyemi, Schneider, Game Nexus 2(2), 2025-04-01. The OpenAlex record has no DOI. Its landing page is the cited URL. ISSN 3115-8668 matches the bib note. | ✅ match (title, first author, year, journal, volume and issue). No DOI or PMID exists, so this is a weaker kind of resolution than rows 1-3 and 5-9. |
| 5 | huang2025effects | Huang et al. 2025 (`pm-40567995`) | 10.3389/fpubh.2025.1498606 | Crossref: "Effects of physical fitness using a Kinect system for pre-frail community-dwelling older adults", Huang, Front Public Health, 2025-06-11. PMID 40567995 returns the same title, first author Huang WY and the same DOI. | ✅ match (two routes agree) |
| 6 | liu2025effects | Liu et al. 2025 (`pm-41307454`) | 10.2196/75777 | Crossref: "Effects of an Immersive Virtual Reality–Based Exercise Intervention on Psychological and Physiological Outcomes in College Students: Randomized Controlled Trial", Liu, JMIR Serious Games, 2025-12-15. PMID 41307454 returns the same title and DOI. | ✅ match (two routes agree) |
| 7 | ngo2026effects | Ngo et al. 2026 (`pm-41628428`) | 10.2196/73732 | Crossref: "Effects of Exergaming Tennis on Players' Tennis Skills and Mental State Compared to Regular Tennis in Adult Players: Quasi-Experimental Study", Ngo, JMIR Serious Games, 2026-02-02. PMID 41628428 agrees. | ✅ match (two routes agree) |
| 8 | anderson2026gamified | Anderson et al. 2026 (`pm-42974341`) | 10.26603/001c.172561 | Crossref: "Gamified Versus Traditional Balance Training: Effects on Balance and Motivation in Collegiate Student-Athletes", Anderson, Int J Sports Phys Ther, 2026-11-01. PMID 42974341 agrees. | ✅ match (two routes agree) |
| 9 | tunc2026rehabilitative | Tunc et al. 2026 (`pm-43021294`) | 10.1186/s13102-026-01981-6 | Crossref: "Rehabilitative game-based exercise integrated into conservative treatment for adolescent idiopathic scoliosis: a pilot randomized controlled trial", Tunc, BMC Sports Sci Med Rehabil, 2026-08-18. PMID 43021294 agrees. | ✅ match (two routes agree) |

### Key reconciliation

- Keys cited in review.md: 9 (page2021prisma, campbell2020synthesis, sterne2019rob, nikolova2025effect, huang2025effects, liu2025effects, ngo2026effects, anderson2026gamified, tunc2026rehabilitative).
- Entries in references.bib: 9, with the same 9 keys.
- Cited but absent from the bib: none.
- In the bib but never cited: none.
- Citations in tables, figure captions and prose all use keys from this set. The `## References` heading at the end is empty in the source, which is expected for pandoc to fill at build time.
- Keys are written as `@key` in table cells (Section 3.2 and 3.4) and in the Figure 3 caption. All of them resolve to bib entries.
- The excluded-report table in 3.1 names records by ID only (`oa-W…`, `pm-…`). It states that none is cited, and none carries a key, so those are outside this check.

### Author and year agreement

- The review states no author names or years apart from the key text. Each key's surname and year agree with the resolved record, taking the first author's family name and the Crossref or OpenAlex publication year. Tunc 2026 is online 2026-08, and Anderson 2026 is 2026-11-01. Liu 2025 is 2025-12-15. Huang 2025 is 2025-06. Nikolova 2025 is 2025-04. Ngo 2026 is 2026-02. Page 2021, Campbell 2020 and Sterne 2019 agree.
- The Figure 3 caption maps `oa-W7220097264`, `pm-40567995`, `pm-41307454`, `pm-41628428`, `pm-42974341` and `pm-43021294` to nikolova, huang, liu, ngo, anderson and tunc. PubMed confirms each PMID belongs to exactly that first author, so no mapping is crossed.
- The review's tables describe populations and countries (for example Nigeria, Taiwan, United States). These are claims about paper contents and were not checked.
- The publisher page's affiliations for Nikolova et al. are Bulgaria, Nigeria and Germany. This was not checked against the review's "Nigeria" entry, because that is a claim about the paper's content.

### Observations (not failures)

- The review describes @ngo2026effects as randomized, under amendment A3, while the resolved title calls it "Quasi-Experimental Study". The review states this itself in 3.2. This is a content question for the claim-checking audit, not a citation mismatch.
- Volume, issue and page fields in the bib were not compared field by field against Crossref. Only title, first author and year were compared.

### Summary of the table

Checked: 9 of 9 cited works resolved with matching titles. Eight carry a DOI. Five of those were also confirmed by PMID, and the ninth (Nikolova) was resolved through OpenAlex and its publisher page. Failed, unresolved or mismatched: none.

This check confirms that each identifier resolves to a record whose title matches the work cited. It does **not** verify any claim about what these works contain, including the review's numbers, directions, risk-of-bias ratings and descriptions of designs. It also does not cover the records the review names only by ID and states are not cited. For the one reference without a DOI (Nikolova et al.), the match rests on an OpenAlex record and the journal's own page, and no DOI, PMID or indexing database confirms it independently. The OpenAlex record and the journal page come from the same publisher metadata, so they do not count as two independent confirmations.
