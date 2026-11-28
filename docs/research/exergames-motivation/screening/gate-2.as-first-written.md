# Gate 2 — The inclusion set

**Written:** 2026-11-28 · **Decision:** — (awaiting the user) · **Decided by:** —

Screening is finished for the database search and the one backward citation pass.
**Appraisal has not started and will not start until you answer this gate.** To
resume, invoke the command again with the same `--output` and your answers to the
decisions in section 1.

Every count below comes from `prisma-flow.json`, which `screening_stats.py` derived
from `records.csv` and `screening.csv`. All screening decisions were made by
language-model agents (`decided_by=automation`); none is a human decision.

## 1. Decisions needed

### 1.1 The inclusion set is 3 or 4 studies, and 35 reports could not be read

The protocol estimated 10–20 included studies. Screening found **4** (3 if you decide
1.2 against inclusion). The 20-study cap is not reached, so nothing needs narrowing.

Two things made the set small: most reports that were read had no motivation
instrument (15 of 23 full-text exclusions), and most reports sought were never read. Of 62 reports
sought at full text, **35 were not retrieved** because the protocol fetches full text
only from open-access PubMed Central and arXiv. They are listed by name in section 6.
None of them was excluded on a criterion; nobody has read them. Of the 27 that were
read, 4 were included (15%). I cannot say how many of the 35 would be eligible:
that rate comes from reports that all reached PubMed Central, and the unread ones
differ (24 are not in PubMed at all).

Options:

| Option | What happens | Cost |
|---|---|---|
| **A. You supply full texts** | Any text you provide is saved as `fulltext/<record_id>.txt`, logged as `route=user`, and screened by two agents like any other. The three flagged in section 6 as answered `include` at title/abstract (rows 11, 12 and, by its title, row 26) are the place to start | Your time; the remaining unread reports stay "not retrieved" |
| **B. Amend the protocol to allow publisher open-access copies** | OpenAlex flags an open-access copy at the publisher for 18 of the 35. A dated amendment would let those be fetched, title-checked and screened. The stated limitation shrinks but does not go away | An amendment to a limitation you approved today; about 18 more full-text reads by two screeners each |
| **C. Proceed with the 3–4 studies** | Appraisal starts on the current set. The review reports 35 reports not retrieved and says its answer rests on open-access reports only | A review of 3–4 trials with no two alike in population or instrument; the synthesis will mostly say the evidence is too thin to answer the question |

**Recommendation: B, then A for what B does not reach, starting with row 11** (both
screeners answered include on its abstract, and OpenAlex shows no open-access copy). A
systematic review that could not read 56% of the reports it sought is reporting its
retrieval route more than the literature. If you prefer to keep the limitation as
approved, C is a legitimate result and will be reported as what it is.

### 1.2 `pm-41628428` — escalated by the adjudicator (criterion I2)

Ngo et al. (2026), exergaming tennis versus on-court training, 12 weeks, Sport
Motivation Scale. Participants "were initially randomly allocated"; 7 of 66 then
"requested to change their assigned allocation, and these requests were accommodated"
before training began. The main analysis is by the group actually attended; an
analysis by randomized group is in a supplementary appendix. The paper calls itself
quasi-experimental. One screener excluded it under E2, the other included it with a
doubt; the adjudicator found both had read the passage correctly and that I2/E2 do
not say which side of the line this is.

- **Include:** the departure from randomization is rated under risk of bias (D1, D2),
  where it would count heavily. Needs a sentence in I2: *random allocation after which
  a minority of participants were reassigned at their own request before the
  intervention began is in.*
- **Exclude under E2:** needs the mirror sentence in E2.

Either is a dated amendment. It is carried as included in the counts below, marked
doubtful, only so the arithmetic closes; **it is undecided.**

**Recommendation: include**, and let the risk-of-bias rating carry it. Excluding a
trial that randomized and reported an analysis by randomized group, on a criterion
that does not clearly exclude it, is the less defensible reading. It was also used as
a seed for citation searching (it contributed 2 records, both excluded); if you exclude
it, the log will say so.

### 1.3 Doubtful inclusions: 3 of the 4

More than a tenth of the set, so the criterion should be settled rather than the
doubts carried into appraisal.

| Criterion | Record | The question left open | The sentence that would settle it |
|---|---|---|---|
| I1 Exergame intervention | `pm-40567995` Huang et al. (2025), Kinect aerobic dance, pre-frail older adults, BREQ-2 | The Kinect system scores limb angles against a model; the paper never calls it a game. The comparator did the same dance from a video (so I3 depends on I1 too). One screener also noted the paper gives per-interval P values rather than one labelled between-group test (I6) | *A movement-training system that gives the player a running score for matching target movements is an exergame under I1, whether or not the paper calls it a game* — or its opposite |
| I1 Exergame intervention | `pm-43021294` Tunç et al. (2026), game-based balance and core exercise, adolescent idiopathic scoliosis, MSPPA | The games' mechanics are in an appendix that is not in the saved text, so neither screener could confirm movement is the game input. The game arm is also a mixed programme whose first 4 weeks were conventional in both arms | No amendment needed: the protocol already admits mixed programmes. The appendix would settle the rest; if you can supply it, the record is re-checked |
| I2 Randomized allocation | `pm-41628428` | See 1.2 | See 1.2 |

Only `pm-41307454` (Liu et al., 2025; VR cycling versus no intervention, college
students, BREQ-2) was included by both screeners with no doubt.

**Recommendation:** adopt the I1 sentence in the inclusive form (a running score for
matching movements is a goal the movement pursues, which is what I1 asks), keep both
records, and let the appraisal judges rule on eligibility again from the full paper —
they are required to, and a study either judge doubts is brought back to you.

### 1.4 Amendments for you to ratify or reverse

| # | Amendment | Status |
|---|---|---|
| A1 | At title/abstract, E5 is cited only when the abstract says how motivation was assessed and that way is on I5's Out list, or the report is qualitative only. An abstract that merely lists outcomes without a motivation instrument is `unsure` | **Made by the orchestrator during calibration without your prior approval** (protocol section 14 has the full text and reason). It can only advance records, never exclude one. It raised the full-text volume from a projected 14 to 60, which is inside the protocol's own 55–75 estimate. Of the 5 pilot records it changed from exclude to `unsure`, 1 was read and excluded at full text under E5 and 4 are among the not-retrieved. Reversing it means screening the 146 records at title/abstract again under the old rule |
| proposed | I4: *where a paper gives conflicting durations, the schedule in the Methods decides over the Abstract* | Proposed by the adjudicator; would make the `pm-41384807` exclusion follow from the criterion rather than from a reading |
| proposed | I2 sentence, per 1.2 | Depends on your answer to 1.2 |
| proposed | I1 sentence, per 1.3 | Depends on your answer to 1.3 |

**Recommendation:** ratify A1; adopt the I4 sentence.

## 2. Flow counts

| | Databases | Citation searching |
|---|---|---|
| Records identified | PubMed 83, OpenAlex 106 (189) | 6 |
| Duplicates removed before screening | 49 | 0 |
| Records screened at title/abstract | 140 | 6 |
| Excluded at title/abstract | 80 | 4 |
| Reports sought | 60 | 2 |
| **Reports not retrieved** | **35** | 0 |
| Reports assessed at full text | 25 | 2 |
| Excluded at full text | 21 | 2 |
| Reports included | 4 (one undecided, see 1.2) | 0 |

Full-text exclusions, databases: E5 No named motivation instrument 15; E1 Not an
exergame 3; E2 Not randomized 1; E4 Under two weeks 1; E6 No motivation results by
arm 1. Citation searching: E4 Under two weeks 2.

Studies included: 4, from 4 reports. Excluded by automation tools: all; by a human
reviewer: 0.

Citation searching: backward only, one iteration, 4 seeds, 192 references listed,
6 new records after the protocol's filters; the cap of 20 was not reached. The pass
added no inclusion. Forward searching was not run.

The OpenAlex search ran without a key and completed (106 of 106).

## 3. Agreement

| Stage | Pairs | Raw agreement | Cohen's κ |
|---|---|---|---|
| Title/abstract | 146 | 0.966 | 0.933 |
| Full text | 27 | 0.926 | 0.71 |

Both are above the protocol's 0.60 threshold. They are agreement between two
instances of one model, which share training; the number overstates what it would
mean between two people.

**Calibration changed a criterion's stage rule.** In the first pilot (20 records) the
two screeners gave the same decision on all 20 records (2 advanced) —
and both recorded a doubt on E5 for the same records. Agreement had hidden a shared
doubt, so the rule was amended (A1) and the pilot re-run with fresh screeners: 7 of 20
advanced, both screeners agreeing on all 20. First-round files are in
`screening/pilot-round1/`.

## 4. Adjudications

Two full-text disagreements; file `screening/adjudication-main.csv`.

| Record | Screeners | Adjudicator | Reasoning |
|---|---|---|---|
| `pm-41384807` (IMI interest/enjoyment; exergame versus video-guided exercise) | exclude E4 / include | **exclude, E4: Under two weeks** | The Abstract says "once per week for 7 weeks"; the Methods say "daily for 7 consecutive days" and "At the end of the 1-week period", and the Results say "over the 1-week intervention period". The screener who included relied on the Abstract. The IMI was also given only "Immediately following the first intervention" |
| `pm-41628428` | exclude E2 / include | **escalated** | See 1.2 |

No pattern across the two: they turn on different criteria.

## 5. Near-misses (PRISMA item 16b)

Records that measured or addressed motivation and fell on one criterion.

| Record | What it is | Excluded under | Why |
|---|---|---|---|
| `pm-41384807` | Randomized three-arm exergame trial with the IMI interest/enjoyment subscale | E4 | One-week programme (adjudicated, above) |
| `s1-oa-W4403263759` | VR HIIT boxing versus circuit training, randomized crossover, Situational Motivation Scale reported for both conditions | E4 | One session per condition; the protocol's crossover rule excludes it. Fails on duration alone |
| `pm-41627139` | VR trial using BREQ-2 | E6 | A single relative autonomy index score is reported; no comparator-arm result |
| `pm-42974341` | Wii Fit trial using the IMI | E2 | "Pseudo-randomized" by one investigator, called quasi-experimental; the IMI was also given only to the training groups |
| `pm-42247423` | Ring Fit Adventure versus usual activities, 8 weeks | E5 | "Sports motivation" was a registered outcome that the authors say will be "reported separately"; this report has none. **A companion report may exist or appear; it was not in the search results** |
| `pm-41032869` | Active video games in schizophrenia | E5 | Only a self-written 4-item behavioural-intention questionnaire; intention alone is out under I5 |
| `pm-42179992` | VR serious games in depression (title/abstract) | E5 | Motivation on a visual analogue scale, read as a single item |
| `pm-39335412` | Sensor-based balance exergaming (title/abstract) | E5 | Pittsburgh Rehabilitation Participation Scale: clinician-rated participation, on I5's Out list |

## 6. Reports not retrieved — all 35

Full text is retrieved only from open-access PubMed Central and arXiv (protocol
sections 1 and 6). These reports were sought and not retrieved. **None was excluded
on a criterion, and none has been read.** 11 are PubMed records without an
open-access PubMed Central text; 24 came from OpenAlex only and have no Europe PMC
record. No route was tried other than the two the protocol names. The last column is
what title/abstract screening left open; it is not a prediction of eligibility.

| # | Record | Report | Identifier | Why not retrieved | At title/abstract |
|---|---|---|---|---|---|
| 1 | `oa-W4413422558` | Jorge Luiz de Brito Gomes (2025). 24-hour blood response comparison between exergaming and aerobic exercise in type-1 diabetes: A randomised study. *Science & Sports* | doi:10.1016/j.scispo.2025.07.009 | Not in PubMed; no Europe PMC record for the DOI | — |
| 2 | `oa-W7143500910` | Alexandre Faria Rocha (2026). Effects of exergames intervention on neuropsychiatric symptoms in older adults with neurocognitive disorders. *Jornal Brasileiro de Psiquiatria* | doi:10.1590/0047-2085-2025-0080 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — E5: NPI apathy subscale is an apathy scale (Out list), not motivation for exercise; whether another motivation measure exists is unknown |
| 3 | `pm-39952553` | Hicks J (2025). Is exergaming a viable exercise option for obese black women?. *Contemp Clin Trials* | doi:10.1016/j.cct.2025.107846 · PMID 39952553 | In PubMed; no open-access PubMed Central text | OpenAlex flags an open-access copy at the publisher |
| 4 | `oa-W4414250592` | Rasouli Nasim (2024). The effect of Game-Based Interventions on the Learning Disabilities of Primary School Students. *مجله علوم پزشکی رازی* | doi:10.47176/rjms.31.110 | Not in PubMed; no Europe PMC record for the DOI | open at title/abstract — E8: English abstract but full text language not shown; E5: no motivation instrument listed but secondary outcomes may be unlisted |
| 5 | `oa-W4394692400` | Müberra Tanrıverdi (2024). Video-based exergaming versus conventional rehabilitation on balance in pediatric brain tumor survivors: a randomized clinical trial. *Virtual Reality* | doi:10.1007/s10055-024-00988-z | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher |
| 6 | `pm-40983137` | Ozyemisci Taskiran O (2025). The effect of a 12-week tele-exercise using immersive virtual reality on functional capacity in adolescents with cystic fibrosis: A randomized controlled, single (assessor) - blind study. *Respir Med* | doi:10.1016/j.rmed.2025.108362 · PMID 40983137 | In PubMed; no open-access PubMed Central text | open at title/abstract — I1: is immersive VR exercise an exergame? |
| 7 | `oa-W4413201399` | Agrawal Luckykumar Dwarkadas (2025). Augmenting Conventional Therapy with Non-immersive Virtual Reality to Enhance Balance, Coordination, Motivation, and Functional Performance in Children with Spastic Diplegia Cerebral Palsy: A Single-Blinded Randomized Trial. *Arabian Journal for Science and Engineering* | doi:10.1007/s13369-025-10535-w | Not in PubMed; no Europe PMC record for the DOI | — |
| 8 | `pm-39069966` | Stephan AT (2024). Older Adults' Perceptions of Cognitive, Physical, and Exergame Training: A Mixed Methods Investigation of a Four-Armed Randomized Controlled Pilot Trial. *Games Health J* | doi:10.1089/g4h.2023.0208 · PMID 39069966 | In PubMed; no open-access PubMed Central text | open at title/abstract — I5: unnamed feedback items on motivation may not be a named instrument |
| 9 | `pm-38801680` | Amin F (2024). Effectiveness of Immersive Virtual Reality-Based Hand Rehabilitation Games for Improving Hand Motor Functions in Subacute Stroke Patients. *IEEE Trans Neural Syst Rehabil Eng* | doi:10.1109/tnsre.2024.3405852 · PMID 38801680 | In PubMed; no open-access PubMed Central text | OpenAlex flags an open-access copy at the publisher; open at title/abstract — I1: are VR games driven by hand and forearm movements exergames or finger/hand-only games? |
| 10 | `oa-W4405999390` | Zhan Huai Teoh (2024). Impact of Gaming Skills on Laparoscopic Performance: A Single-Blinded Randomised Controlled Trial. *Education in Medicine Journal* | doi:10.21315/eimj2024.16.4.10 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — I1: whether Switch gaming involves body movement as input is not stated |
| 11 | `pm-42223906` | Shamsoddini A (2026). Impact of virtual reality versus conventional balance training on balance function and fear of falling in older adults: a single blinded, randomized controlled trial. *Eur Geriatr Med* | doi:10.1007/s41999-026-01493-z · PMID 42223906 | In PubMed; no open-access PubMed Central text | **one screener answered include at title/abstract** |
| 12 | `oa-W7220200190` | Mohammad Bagher Jafari (2025). Impact of Mobile Fitness Game Apps on Motivation and Lifestyle Change Readiness. *Game Nexus* | no DOI | No PMID, arXiv ID or DOI | **one screener answered include at title/abstract**; OpenAlex flags an open-access copy at the publisher; open at title/abstract — I1: is a mobile fitness game app movement-driven or driven by accumulated steps? |
| 13 | `oa-W7237392436` | مریم شامی (2025). Radiology, Nuclear Medicine and Medical Imaging at the vanguard of artificial intelligence integration: A preliminary study of AI in medical research. *Bushehr University of Medical Sciences Repository (Bushehr University of Medical Sciences)* | no DOI | No PMID, arXiv ID or DOI | open at title/abstract — I1: does a health video game described as serious/active video game meet the movement-as-input definition? |
| 14 | `oa-W4414186250` | S Sivapriya (2026). The effect of exergaming on balance among children with intellectual disability. *Journal of Associated Medical Sciences* | doi:10.12982/jams.2026.008 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — E5: abstract names only balance outcome; unlisted secondary motivation outcome possible |
| 15 | `oa-W7165591188` | Ausaf Chaudhary (2026). Efficacy of a Therapist-Guided Virtual Reality Exercise Program for Chronic Nonspecific Low Back Pain. *Journal of Health Wellness and Community Research* | doi:10.61919/3vp5w327 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — I1: is therapist-guided VR exercise a game with a goal or score? |
| 16 | `oa-W7125699163` | Bulbul Bhajikhaye (2026). COMPARISON BETWEEN THE EFFECT OF EXERGAMING AEROBICS ANDTRADITIONAL AEROBICS EXERCISE PROGRAM ON BODY MASS INDEX,RATE OF PERCEIVED EXERTION, WAIST HIP RATIO AND TOTAL FAT % INGRADE 1 OBESE POPULATION. *Indian journal of physical therapy* | doi:10.63299/ijopt.070192 | Not in PubMed; no Europe PMC record for the DOI | open at title/abstract — E5: abstract lists outcomes without a motivation instrument; unlisted outcome possible |
| 17 | `pm-42583323` | Singh I (2026). Effectiveness of Computer-based Exergaming on Upper Limb Motor Function, Functional Independence, and Quality of Life in Individuals with Spinal Cord Injury: A Randomized Control Trial. *Top Spinal Cord Inj Rehabil* | doi:10.46292/sci25-00098 · PMID 42583323 | In PubMed; no open-access PubMed Central text | OpenAlex flags an open-access copy at the publisher; open at title/abstract — E5: abstract lists motor and QOL outcomes only; unlisted motivation outcome possible |
| 18 | `pm-42551496` | Ali MS (2026). Effects of Virtual Reality Versus Whole-Body Vibration on Muscle Strength and Balance in Children with Duchenne Muscular Dystrophy: a Randomized Controlled Trial. *NeuroRehabilitation* | doi:10.1177/10538135261473293 · PMID 42551496 | In PubMed; no open-access PubMed Central text | open at title/abstract — E5: abstract lists outcomes without a motivation instrument; unlisted secondary outcomes possible |
| 19 | `oa-W7213433529` | Senthil Kumaran D (2025). ROLE OF BIOMIMETIC CONTROL MECHANISMS IN GAME-BASED REHABILITATION ON UPPER LIMB MOTOR FUNCTION IN PATIENTS WITH STROKE: A PILOT RANDOMIZED CONTROLLED TRIAL PROVIDE HIGH REPETITION MOTIVATION & ENGAGEMENT. *no venue recorded* | doi:10.13140/rg.2.2.23549.12000 | Not in PubMed; no Europe PMC record for the DOI | — |
| 20 | `oa-W7220702081` | Ruhollah Solat (2026). Designing and evaluating the effect of a motivational VR game-based intervention on metabolic management in children and adolescents diagnosed with diabetes. *Rooyesh Psychological Journal* | doi:10.66224/rooyesh.15.5.21 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex gives the language as `fa`; OpenAlex flags an open-access copy at the publisher; open at title/abstract — I1: unclear whether VR shooting game is driven by limb or trunk movement |
| 21 | `pm-42261097` | Khorasani A (2026). Wearable Myoelectric Interface for Neurorehabilitation (MINT) to Recover Arm Activity After Stroke: A Randomized Controlled Trial. *Neurorehabil Neural Repair* | doi:10.1177/15459683261454937 · PMID 42261097 | In PubMed; no open-access PubMed Central text | open at title/abstract — I3: sham arm uses 1 muscle and may also play games; abstract does not say |
| 22 | `oa-W4395005416` | Maryam Ansari (2024). The Effectiveness of the Self-Control Training Video Game Slankers: A Pilot Study. *Journal of Cognitive Enhancement* | doi:10.1007/s41465-024-00296-z | Not in PubMed; no Europe PMC record for the DOI | open at title/abstract — I1: title suggests cognitive-training game but does not settle movement input |
| 23 | `oa-W7164739728` | Gwynneth Rizzamelle S. Bolima (2026). Effectiveness of Exergames Using Nintendo Switch Sports for Rehabilitation with Stage 3 Frozen Shoulder. *Zenodo (CERN European Organization for Nuclear Research)* | doi:10.5281/zenodo.20688691 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — I4: duration not stated |
| 24 | `oa-W7130314881` | Sulaiman Sulaiman (2025). The Effectiveness of Educational Game-Based Physical Education Learning on the Development of Elementary School Students' Physical Literacy: A Quasi-Experimental Study. *Jurnal Porkes* | doi:10.29408/porkes.v8i3.31349 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — I1: abstract does not say whether the game is digital or movement-driven |
| 25 | `oa-W4416431672` | Saima Bibi (2025). Virtual Reality-Based Exercises Versus Manual Physiotherapy for Post-ACL Reconstruction Rehabilitation: A Randomized Controlled Trial. *The Healer Journal of Physiotherapy and Rehabilitation Sciences* | doi:10.55735/tjvxqq39 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — I1: is the VR-based exercise a game with a goal or score? |
| 26 | `oa-W7220097264` | Mariana Nikolova (2025). Effect of a VR Exergame Intervention on Exercise Motivation and Self-Efficacy. *Game Nexus* | no DOI | No PMID, arXiv ID or DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — I4: eight sessions with no stated weeks; does schedule span 14 days or more? |
| 27 | `oa-W4415152829` | Andrea Ribeiro (2025). Wii™ e prevenção de quedas: Uma abordagem para melhorar o equilíbrio em pessoas idosas – estudo-piloto. *TER ISAVE* | doi:10.71399/hcagkw98 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — E8: English abstract but Portuguese title; is the full text English? |
| 28 | `oa-W7167468688` | Mike Studer (2026). Two Goals with One Approach: Elevating Patient Engagement and Outcomes through a Person-Specific Dual Task Prescription. *Journal of Psychology and Neuroscience* | doi:10.47485/2693-2490.1166 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — E9: cannot tell whether this is a primary report |
| 29 | `pm-42857931` | Şen Tekin Ş (2026). The effect of video-based games on upper extremity function and activity participation in children with hemiparetic cerebral palsy. *Dev Neurorehabil* | doi:10.1080/17518423.2026.2738676 · PMID 42857931 | In PubMed; no open-access PubMed Central text | — |
| 30 | `oa-W4402875116` | İlknur Münevver Gönenç (2024). Examination of the effect of different techniques (demonstration, telesimulation and game-based training) in teaching the management of shoulder dystocia: A randomized controlled trial. *Clinical Simulation in Nursing* | doi:10.1016/j.ecns.2024.101611 | Not in PubMed; no Europe PMC record for the DOI | open at title/abstract — E1: game-based training in simulation education is probably not an exergame but title alone does not show it |
| 31 | `oa-W4413463698` | Liu, Ruilin (2025). Research on the strategy of optimizing the training path of sports dance and aesthetics for college students in general colleges and universities based on mathematical modeling. *International journal for housing science and its applications.* | doi:10.70517/ijhsa463600 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher; open at title/abstract — I1: Kinect movement detection for training may lack a game goal or score |
| 32 | `oa-W4415982674` | Dina Fatiyah Bakri (2025). Effects of a virtual reality exergame on cardiorespiratory function in older adults. *Physical Therapy Journal of Indonesia* | doi:10.51559/ptji.v6i2.321 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex flags an open-access copy at the publisher |
| 33 | `pm-41990569` | Yavaş S (2026). The effect of video game-based exercises on selective motor control, balance, fear of falling, and functional capacity in individuals with spastic cerebral palsy: A randomized controlled trial. *Res Dev Disabil* | doi:10.1016/j.ridd.2026.105292 · PMID 41990569 | In PubMed; no open-access PubMed Central text | open at title/abstract — I5: is the Satisfaction Questionnaire or any other tool a motivation instrument? |
| 34 | `pm-41664928` | Hassan Bakri AA (2026). Effect of fully immersive virtual reality on daily pain, functional mobility, and health-related quality of life in pediatric sickle cell disease: a single-blinded randomized clinical trial. *Disabil Rehabil* | doi:10.1080/09638288.2026.2625551 · PMID 41664928 | In PubMed; no open-access PubMed Central text | open at title/abstract — I1: VR used for pain management may not involve movement as game input |
| 35 | `oa-W4408275182` | Simone Burin-Chu (2025). Effets d’un dispositif de réalité virtuelle immersive sur la rééducation du membre supérieur chez des enfants et adolescents atteints de paralysie cérébrale : un essai contrôlé randomisé. *Kinésithérapie la Revue* | doi:10.1016/j.kine.2024.12.110 | Not in PubMed; no Europe PMC record for the DOI | OpenAlex gives the language as `fr`; open at title/abstract — E8: French title suggests full text may not be English but this is not shown |

Three of these look least like the rest: row 13 (`oa-W7237392436`) carries a title
that appears unrelated to the abstract OpenAlex holds for it; row 28 (`oa-W7167468688`) has
a reference list where its abstract should be; rows 10, 22 and 30 are probably not
exergame studies at all. They stay in the list because nothing but a full text can
exclude them.

## 7. The quotation check

75 quotations in the 12 full-text screening files and the adjudication file were
checked against the 27 saved texts: **75 verified, 0 not found, 0 transplanted, 0
uncheckable.** No batch was rejected or replaced. Report:
`checks/quote-check-screening.md`. Each saved text passed the title check before it
was saved; one fetch failed on a connection reset and succeeded on a second attempt
(`pm-41307454`).

## 8. Reports grouped as one study

None among the included reports: 4 reports, 4 studies.

`pm-40321768` (a Research Square preprint) and `pm-40682190` (its published version)
are two reports of one study and were kept as two records at deduplication. Both were
excluded at title/abstract under E3 (every arm plays a game), so the pair does not
reach the inclusion set.

## 9. Things you should know that are not decisions

- **OpenAlex applies stemming.** The protocol says the source has no truncation; its
  parsed-query echo shows it stems terms, so matching was somewhat broader than the
  written string. The string was run as approved and the total matched the pilot
  (106). Logged in `search-log.md`; will be reported.
- **Full-text volume.** The re-pilot projected about 49 full texts; 60 advanced. Both
  are inside or under the protocol's 55–75 estimate, so the run did not stop.
- **Citation-search cap.** 140 unique database records left a cap of
  min(40, 160 − 140) = 20; 6 were found.
- Nothing in any abstract or full text read as an instruction to the screeners.

## To resume

Reply with: your choice on 1.1 (A, B, C, or a mix, with any files); include or
exclude for `pm-41628428`; your reading of I1 for `pm-40567995`; and ratify or
reverse A1 and the I4 sentence. Any individual decision you make or change is recorded
as `decided_by=human`, and the flow counts are re-derived.
