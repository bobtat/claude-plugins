# Protocol (fixture excerpt)

Only sections 7 and 8 are here — `appraisal_check.py` reads nothing else.

## 7. Data items

| Column | Type | Allowed values | Definition |
|---|---|---|---|
| `contribution` | code | attack; defence; both; benchmark | What the study contributes. `both` only when an attack and a defence are each evaluated |
| `injection_vector` | codes | direct write; query only; external content; another agent; other; not stated | How the poison reaches the store. Several may apply |
| `models_evaluated` | text | — | Named models, with versions as the paper states them |
| `n` | text | — | Trials or tasks, as the paper states them |

## 8. Risk of bias

- Instrument: structured critique (not a validated instrument)
- Scale: Low < Some concerns < High
- No information: No information
- Overall: worst domain

| Domain | What undermines the claim |
|---|---|
| D1 Baseline adequacy | No baseline, or only a weak one |
| D2 Reproducibility | No code, prompts or model versions |
| D3 Evaluation validity | A simulated system, or a metric that does not measure harm |
