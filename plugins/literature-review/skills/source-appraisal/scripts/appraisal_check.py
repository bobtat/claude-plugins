#!/usr/bin/env python3
"""Check a review's appraisal data against its protocol, and derive each study's overall rating.

    python3 appraisal_check.py --protocol protocol.md --extraction extraction.csv --rob rob.csv
    python3 appraisal_check.py ... --derive-overall      # after the merge: rewrites rob.csv

Two readers of one paper will word a free-text field differently, and that is harmless.
They must not code a categorical field differently because the categories were never
fixed, or rate on a scale the protocol did not state. So the protocol fixes both, and
this script holds the data to it. Standard library only.

From the protocol it reads:

  Section 7, a table with Column, Type and Allowed values. Type is `code` (exactly
  one value), `codes` (one or more, separated by `;`), `text` or `number`. Only code
  and codes columns are checked.

  Section 8, the lines `Scale: Low < Some concerns < High` (least concern first),
  `No information: <label>` (optional), `Overall: worst domain` or `Overall: none`,
  and a table whose first column is Domain.

It refuses, with exit 2: a coded value outside the list, an empty coded cell, two values
in a `code` column, a judgment off the scale, a study missing a domain or carrying an
unknown one, and an Overall row a reader wrote. The overall rating is arithmetic on the
domain ratings, so a reader never writes it.

--derive-overall rewrites rob.csv with one Overall row per study, marked
`derived: worst domain` in its location column. Running it twice changes nothing.
"""
import argparse, csv, re, sys
from collections import Counter, OrderedDict


def cells(line):
    return [c.strip().strip("`").strip() for c in line.strip().strip("|").split("|")]


def tables(path):
    """Yield (header cells, [row cells]) for each Markdown table in the file."""
    head, rows = None, []
    for line in list(open(path, encoding="utf-8")) + [""]:
        if line.lstrip().startswith("|"):
            if head is None:
                head = cells(line)
            elif not re.fullmatch(r"[\s|:\-]+", line.strip()):
                rows.append(cells(line))
        elif head is not None:
            yield head, rows
            head, rows = None, []


def load_protocol(path):
    errs, codes, domains = [], OrderedDict(), []
    for head, rows in tables(path):
        low = [h.lower() for h in head]
        if {"column", "type", "allowed values"} <= set(low):
            ci, ti, ai = low.index("column"), low.index("type"), low.index("allowed values")
            for r in rows:
                if len(r) <= max(ci, ti, ai):
                    continue
                kind = r[ti].lower()
                if kind not in ("code", "codes", "text", "number"):
                    errs.append(f"data item {r[ci]}: type {r[ti]!r} is not code, codes, text or number")
                if kind in ("code", "codes"):
                    vals = [v.strip().strip("`").strip() for v in r[ai].split(";") if v.strip(" `—-")]
                    if len(vals) < 2:
                        errs.append(f"data item {r[ci]}: a {kind} column needs its allowed values, separated by ';'")
                    codes[r[ci]] = (kind, vals)
        elif low and low[0] == "domain":
            domains = [r[0] for r in rows if r and r[0]]
    text = open(path, encoding="utf-8").read()

    def setting(name):
        m = re.search(r"^[\s>*-]*\**" + name + r"\**\s*:\**\s*(.+?)\s*$", text, re.M | re.I)
        return m.group(1).strip().strip("*`. ") if m else None

    scale = [s.strip().strip("*`") for s in (setting("Scale") or "").split("<") if s.strip()]
    overall = (setting("Overall") or "").lower()
    if not codes:
        errs.append(f"{path}: no data-item table with Column, Type and Allowed values")
    if len(scale) < 2:
        errs.append(f"{path}: no 'Scale: A < B < C' line stating the rating scale, least concern first")
    if overall not in ("worst domain", "none"):
        errs.append(f"{path}: no 'Overall: worst domain' or 'Overall: none' line")
    if not domains:
        errs.append(f"{path}: no table of risk-of-bias domains (first column 'Domain')")
    return {"codes": codes, "scale": scale, "noinfo": setting("No information"),
            "overall": overall, "domains": domains}, errs


def norm(s):
    return re.sub(r"\s+", " ", s).strip().lower()


def check_extraction(path, proto):
    errs = []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        rows, header = list(r), r.fieldnames or []
    for col in proto["codes"]:
        if col not in header:
            errs.append(f"{path}: no column {col!r}, which the protocol defines as a coded data item")
    for row in rows:
        sid = row.get("study_id", "?")
        for col, (kind, allowed) in proto["codes"].items():
            if col not in row:
                continue
            ok = {norm(a) for a in allowed}
            vals = [v for v in (x.strip() for x in (row[col] or "").split(";")) if v]
            if not vals:
                errs.append(f"{sid}: {col} is empty; a coded item always has a value from its list")
            elif kind == "code" and len(vals) > 1:
                errs.append(f"{sid}: {col} takes one value and has {len(vals)}: {row[col]!r}")
            for v in vals:
                if norm(v) not in ok:
                    errs.append(f"{sid}: {col} = {v!r} is not one of: {'; '.join(allowed)}")
    return rows, errs


def is_derived(row):
    return (row.get("location") or "").strip().lower().startswith("derived")


def check_rob(path, proto):
    errs = []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        rows, header = list(r), r.fieldnames or []
    need = ["study_id", "instrument", "domain", "judgment", "support_quote", "location"]
    miss = [c for c in need if c not in header]
    if miss:
        return rows, header, [f"{path}: missing column(s) {', '.join(miss)}"]
    scale = {norm(s): s for s in proto["scale"]}
    if proto["noinfo"]:
        scale[norm(proto["noinfo"])] = proto["noinfo"]
    known = {norm(d): d for d in proto["domains"]}
    seen = {}
    for row in rows:
        sid, dom = row["study_id"], row["domain"].strip()
        if norm(dom) == "overall":
            if not is_derived(row):
                errs.append(f"{sid}: an Overall row a reader wrote; it is derived from the domains, never judged")
            continue
        if norm(dom) not in known:
            errs.append(f"{sid}: domain {dom!r} is not in the protocol's list")
        if norm(row["judgment"]) not in scale:
            errs.append(f"{sid} {dom}: judgment {row['judgment']!r} is not on the scale ({' < '.join(proto['scale'])})")
        if norm(dom) in seen.setdefault(sid, set()):
            errs.append(f"{sid}: more than one row for domain {dom!r}")
        seen[sid].add(norm(dom))
    for sid, doms in seen.items():
        for d in known:
            if d not in doms:
                errs.append(f"{sid}: no row for domain {known[d]!r}")
    return rows, header, errs


def overall_for(rows, proto):
    rank = {norm(s): i for i, s in enumerate(proto["scale"])}
    worst = max((rank[norm(r["judgment"])] for r in rows if norm(r["judgment"]) in rank), default=None)
    return proto["noinfo"] or "No information" if worst is None else proto["scale"][worst]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--protocol", required=True)
    ap.add_argument("--extraction", help="extraction.csv, or one reader's row")
    ap.add_argument("--rob", help="rob.csv, or one reader's rows")
    ap.add_argument("--derive-overall", action="store_true", help="rewrite --rob with derived Overall rows")
    a = ap.parse_args()
    if not (a.extraction or a.rob):
        ap.error("give --extraction, --rob or both")
    try:
        proto, errs = load_protocol(a.protocol)
        if errs:
            print("The protocol does not fix what the appraisal data must be checked against:", file=sys.stderr)
            for e in errs:
                print(f"  - {e}", file=sys.stderr)
            return 2
        ext_rows = rob_rows = None
        if a.extraction:
            ext_rows, e = check_extraction(a.extraction, proto); errs += e
        if a.rob:
            rob_rows, header, e = check_rob(a.rob, proto); errs += e
    except OSError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    if errs:
        print("Appraisal data does not match the protocol; nothing derived:", file=sys.stderr)
        for e in errs:
            print(f"  - {e}", file=sys.stderr)
        return 2

    if ext_rows is not None:
        print(f"extraction: {len(ext_rows)} studies, {len(proto['codes'])} coded columns, every value in its list")
    if rob_rows is not None:
        domain_rows = [r for r in rob_rows if norm(r["domain"]) != "overall"]
        by_study = OrderedDict()
        for r in domain_rows:
            by_study.setdefault(r["study_id"], []).append(r)
        print(f"risk of bias: {len(by_study)} studies x {len(proto['domains'])} domains, every judgment on the scale")
        overall = Counter()
        if proto["overall"] == "worst domain":
            out = []
            for sid, rs in by_study.items():
                o = overall_for(rs, proto); overall[o] += 1
                out += rs + [{**{h: "" for h in header}, "study_id": sid, "instrument": rs[0]["instrument"],
                              "domain": "Overall", "judgment": o, "location": "derived: worst domain"}]
            if a.derive_overall:
                with open(a.rob, "w", newline="", encoding="utf-8") as f:
                    w = csv.DictWriter(f, fieldnames=header, lineterminator="\n")
                    w.writeheader(); w.writerows(out)
            order = proto["scale"] + ([proto["noinfo"]] if proto["noinfo"] else [])
            print("overall (worst domain): " + ", ".join(f"{k} {overall[k]}" for k in order if overall[k])
                  + ("" if a.derive_overall else "  [not written; pass --derive-overall]"))
        elif a.derive_overall:
            print("overall: the protocol says none; nothing written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
