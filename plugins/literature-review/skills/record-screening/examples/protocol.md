# Protocol (fixture excerpt)

Only section 2 is here — `screening_stats.py --protocol` reads nothing else.

## 2. Eligibility criteria

| Code | Label | Criterion | Decidable at title/abstract? |
|---|---|---|---|
| I1 | Language-model agent | The system studied is built on a large language model | yes |
| I2 | Adult users | The study population is adults (18 or over) | no — full text |
| I3 | Primary research | The report presents new empirical results | yes |
| I4 | Agent system | The system acts over multiple steps with tools or memory | yes |
| E1 | Not a language model | The system is not built on a large language model | yes |
| E2 | Not adults | The study population includes anyone under 18 | no — full text |
| E3 | Not primary research | The report is a review, editorial or position paper | yes |
| E4 | Not an agent system | The system answers single prompts with no tools or memory | yes |

E<n> is the mirror of I<n>: a record failing I<n> is excluded under E<n>.
