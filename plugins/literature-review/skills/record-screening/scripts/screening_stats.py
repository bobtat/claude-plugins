#!/usr/bin/env python3
"""Derive PRISMA flow counts and screening agreement from records.csv and screening.csv.

    python3 screening_stats.py records.csv screening.csv --out prisma-flow.json

The JSON is the input to review-figures' prisma_flow.py, so no number in the flow
diagram is transcribed by hand. Standard library only.

The files are checked for consistency first — an unscreened record, a screening
row for a duplicate, an exclusion with no reason — and the script refuses to emit
counts from inconsistent data, for the same reason the generator refuses to draw
a flow whose arithmetic does not close.
"""
import csv, json, sys, argparse
from collections import Counter, OrderedDict

COL_A = {"database", "register"}
DECISIONS = {"include", "exclude", "unsure"}
REMOVED_LABELS = {
    "duplicate": "Duplicate records removed",
    "automation_ineligible": "Records marked as ineligible by automation tools",
}


def load(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def kappa(pairs):
    """Cohen's kappa over (rater1, rater2) label pairs. None when undefined."""
    n = len(pairs)
    if not n:
        return None
    labels = sorted({a for a, _ in pairs} | {b for _, b in pairs})
    po = sum(1 for a, b in pairs if a == b) / n
    c1, c2 = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    pe = sum((c1[l] / n) * (c2[l] / n) for l in labels)
    if pe >= 1:
        return None
    return (po - pe) / (1 - pe)


def validate(records, screening):
    errs = []
    by_id = {r["record_id"]: r for r in records}
    if len(by_id) != len(records):
        errs.append("records.csv has duplicate record_id values")
    kept = {rid for rid, r in by_id.items() if r["pre_screen"] == "kept"}
    rows = {}
    for s in screening:
        key = (s["record_id"], s["stage"])
        if key in rows:
            errs.append(f"{s['record_id']}: more than one {s['stage']} row")
        rows[key] = s
        if s["record_id"] not in by_id:
            errs.append(f"{s['record_id']}: screened but not in records.csv")
        elif by_id[s["record_id"]]["pre_screen"] != "kept":
            errs.append(f"{s['record_id']}: screened but marked {by_id[s['record_id']]['pre_screen']}")
        if s["stage"] not in ("title_abstract", "full_text"):
            errs.append(f"{s['record_id']}: unknown stage {s['stage']!r}")
        for col in ("screener_1", "screener_2"):
            if s[col] not in DECISIONS:
                errs.append(f"{s['record_id']} {s['stage']}: {col}={s[col]!r}")
        if s["final"] not in ("include", "exclude"):
            errs.append(f"{s['record_id']} {s['stage']}: final={s['final']!r}")
        if s["decided_by"] not in ("automation", "human"):
            errs.append(f"{s['record_id']} {s['stage']}: decided_by={s['decided_by']!r}")
        if s["stage"] == "full_text" and s["final"] == "exclude" \
                and s.get("full_text_retrieved") == "yes" and not s["final_criterion"].strip():
            errs.append(f"{s['record_id']}: excluded at full text with no reason")
    for rid in kept:
        if (rid, "title_abstract") not in rows:
            errs.append(f"{rid}: kept but never screened at title/abstract")
        ta = rows.get((rid, "title_abstract"))
        if ta and ta["final"] == "include" and (rid, "full_text") not in rows:
            errs.append(f"{rid}: advanced at title/abstract but has no full_text row")
        if ta and ta["final"] == "exclude" and (rid, "full_text") in rows:
            errs.append(f"{rid}: excluded at title/abstract yet has a full_text row")
    return errs, by_id, rows


def derive(records, screening):
    errs, by_id, rows = validate(records, screening)
    if errs:
        return None, errs

    def col(r):
        return "A" if r["source_type"] in COL_A else "B"

    out = OrderedDict()
    ident_a = OrderedDict()
    for r in records:
        if col(r) == "A":
            ident_a[r["source_db"]] = ident_a.get(r["source_db"], 0) + 1
    out["databases"] = {k: v for k, v in ident_a.items()
                        if any(x["source_db"] == k and x["source_type"] == "database" for x in records)}
    regs = {k: v for k, v in ident_a.items() if k not in out["databases"]}
    if regs:
        out["registers"] = regs

    removed = OrderedDict()
    for r in records:
        if col(r) != "A" or r["pre_screen"] == "kept":
            continue
        label = REMOVED_LABELS.get(r["pre_screen"], "Records removed for other reasons")
        removed[label] = removed.get(label, 0) + 1
    if removed:
        out["removed_before_screening"] = removed

    def stage_rows(column, stage):
        return [rows[(rid, stage)] for rid, r in by_id.items()
                if col(r) == column and (rid, stage) in rows]

    ta_a = stage_rows("A", "title_abstract")
    out["screened"] = len(ta_a)
    exc = [s for s in ta_a if s["final"] == "exclude"]
    out["excluded"] = OrderedDict([
        ("by automation tools", sum(1 for s in exc if s["decided_by"] == "automation")),
        ("by a human reviewer", sum(1 for s in exc if s["decided_by"] == "human")),
    ])

    def fulltext(column):
        ft = stage_rows(column, "full_text")
        nr = [s for s in ft if s.get("full_text_retrieved") != "yes"]
        assessed = [s for s in ft if s.get("full_text_retrieved") == "yes"]
        reasons = Counter(s["final_criterion"].strip() for s in assessed if s["final"] == "exclude")
        return len(ft), len(nr), len(assessed), OrderedDict(sorted(reasons.items(), key=lambda kv: -kv[1]))

    out["sought"], out["not_retrieved"], out["assessed"], out["excluded_with_reasons"] = fulltext("A")

    notes = []
    b_records = [r for r in records if col(r) == "B"]
    if b_records:
        om = OrderedDict()
        for r in b_records:
            om[r["source_db"]] = om.get(r["source_db"], 0) + 1
        out["other_methods"] = om
        (out["other_sought"], out["other_not_retrieved"],
         out["other_assessed"], out["other_excluded_with_reasons"]) = fulltext("B")
        b_dup = sum(1 for r in b_records if r["pre_screen"] != "kept")
        b_ta_exc = sum(1 for s in stage_rows("B", "title_abstract") if s["final"] == "exclude")
        notes.append(
            f"Other methods: {len(b_records)} identified, {b_dup} removed before screening "
            f"and {b_ta_exc} excluded at title/abstract before {out['other_sought']} were "
            f"sought. The v2 template has no box for these; state them in the caption.")

    included = [s for s in screening if s["stage"] == "full_text" and s["final"] == "include"]
    out["included_reports"] = len(included)
    out["included_studies"] = len({(s.get("study_id") or s["record_id"]) for s in included})

    stats = OrderedDict()
    for stage in ("title_abstract", "full_text"):
        # A report whose full text was never retrieved could not be judged, so its
        # votes say nothing about agreement and would inflate kappa.
        pairs = [(s["screener_1"], s["screener_2"]) for s in screening
                 if s["stage"] == stage
                 and not (stage == "full_text" and s.get("full_text_retrieved") != "yes")]
        k = kappa(pairs)
        stats[stage] = OrderedDict([
            ("pairs", len(pairs)),
            ("raw_agreement", round(sum(a == b for a, b in pairs) / len(pairs), 3) if pairs else None),
            ("kappa", round(k, 3) if k is not None else None),
        ])
    out["screening_agreement"] = stats
    out["notes"] = notes
    return out, []


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("records")
    ap.add_argument("screening")
    ap.add_argument("--out", help="write JSON here instead of stdout")
    a = ap.parse_args()
    out, errs = derive(load(a.records), load(a.screening))
    if errs:
        print("Screening data is inconsistent; no counts emitted:", file=sys.stderr)
        for e in errs:
            print(f"  - {e}", file=sys.stderr)
        return 2
    text = json.dumps(out, indent=2) + "\n"
    if a.out:
        open(a.out, "w").write(text)
    else:
        sys.stdout.write(text)
    for stage, s in out["screening_agreement"].items():
        k = "undefined (no variation)" if s["kappa"] is None else s["kappa"]
        print(f"{stage}: {s['pairs']} pairs, raw agreement {s['raw_agreement']}, kappa {k}",
              file=sys.stderr)
    for n in out["notes"]:
        print(f"note: {n}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
