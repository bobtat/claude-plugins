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
