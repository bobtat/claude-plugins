#!/usr/bin/env python3
"""Merge two judges' ratings of each study, and say what still needs adjudicating.

    python3 appraisal_merge.py --protocol protocol.md --dir appraisals \\
        --rob rob.csv --extraction extraction.csv --stats appraisal-agreement.json

Each study is extracted once and judged twice, by judges who never see each other's
work. This script is the only place their ratings meet. Standard library only.

It reads, per study, from --dir:
  <study>.extraction.csv        the extractor's row
  <study>.j1.rob.csv, .j2.rob.csv   each judge's domain ratings
  <study>.j1.md, .j2.md         each judgment, with a line `- Eligibility: clear` or
                                `- Eligibility: doubtful:I3`
  <study>.j1.queries.csv, ...   optional: extraction values a judge disputes
                                (study_id,column,extracted,suggested,support_quote,location)
  <study>.adjudication.csv      optional: the adjudicator's decisions
                                (study_id,item,decision,support_quote,location,reasoning)

Where the judges agree on a domain, that is the rating. Where they differ, or a judge
queried an extracted value, an adjudication row must decide it: `item` is the domain or
the column, `decision` a rating on the scale, a value from the column's list, `keep`, or
`escalate`. Eligibility is not adjudicated: a study either judge doubts is doubtful.

Exit 1, writing only --pending, while anything is undecided. Exit 2 on data it cannot
use. Otherwise it writes rob.csv (domain rows, with a `basis` column: agreed,
adjudicated or escalated), extraction.csv (with adjudicated corrections and the
eligibility column) and the agreement statistics. Run appraisal_check.py on the results.

--escalated worse settles what the adjudicator escalated when nobody can rule: the more
severe of the two ratings is taken, and a queried value is kept as extracted. Every such
item is listed under `escalated` in the statistics, and an escalated rating is also
marked in rob.csv's basis column, so a person can find them. A kept value may be wrong:
it was escalated because the protocol could not say which value is right.
"""
import argparse, csv, glob, json, os, re, sys
from collections import Counter, OrderedDict

sys.dont_write_bytecode = True          # leave no __pycache__ in an installed plugin
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import appraisal_check as ac

ELIG_RE = re.compile(r"^\s*[-*]\s*\**Eligibility\**\s*:\s*\**\s*(clear|doubtful)\b\s*:?\s*([IE]\d+(?:\s*[/,;+]\s*[IE]\d+)*)?", re.I | re.M)


def rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def kappa(pairs):
    n = len(pairs)
    if not n:
        return None
    po = sum(a == b for a, b in pairs) / n
    ca, cb = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    pe = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / (n * n)
    return None if pe == 1 else round((po - pe) / (1 - pe), 3)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--protocol", required=True)
    ap.add_argument("--dir", required=True, help="the appraisals directory")
    ap.add_argument("--rob", help="write the merged domain ratings here")
    ap.add_argument("--extraction", help="write the merged extraction rows here")
    ap.add_argument("--stats", help="write agreement statistics here (JSON)")
    ap.add_argument("--pending", help="write what needs adjudicating here (default: <dir>/pending-adjudication.csv)")
    ap.add_argument("--escalated", choices=["worse"], help="settle escalated items without a person")
    a = ap.parse_args()

    proto, errs = ac.load_protocol(a.protocol)
    if errs:
        print("The protocol does not fix what the ratings must be merged against:", file=sys.stderr)
        for e in errs:
            print(f"  - {e}", file=sys.stderr)
        return 2
    scale = {ac.norm(s): s for s in proto["scale"]}
    if proto["noinfo"]:
        scale[ac.norm(proto["noinfo"])] = proto["noinfo"]
    rank = {ac.norm(s): i for i, s in enumerate(proto["scale"])}

    studies = sorted(os.path.basename(p)[:-len(".extraction.csv")]
                     for p in glob.glob(os.path.join(a.dir, "*.extraction.csv")))
    if not studies:
        print(f"error: no <study>.extraction.csv in {a.dir}", file=sys.stderr)
        return 2

    pending, rob_out, ext_out, pairs, disagreements, decided = [], [], [], [], [], []
    elig_same = queries_raised = changed = kept = adjudicated = escalated = 0
    for sid in studies:
        f = lambda suffix: os.path.join(a.dir, f"{sid}.{suffix}")
        try:
            ext = rows(f("extraction.csv"))
            if len(ext) != 1:
                errs.append(f"{sid}: extraction file has {len(ext)} rows; one study, one row"); continue
            ext = OrderedDict(ext[0])
            judged, elig = {}, {}
            for j in ("j1", "j2"):
                r, _, e = ac.check_rob(f(f"{j}.rob.csv"), proto)
                errs += [f"{j} {x}" for x in e]
                judged[j] = {ac.norm(x["domain"]): x for x in r if ac.norm(x["domain"]) != "overall"}
                m = ELIG_RE.search(open(f(f"{j}.md"), encoding="utf-8").read())
                if not m:
                    errs.append(f"{sid} {j}: no '- Eligibility: clear' or '- Eligibility: doubtful:<code>' line")
                else:
                    codes = re.findall(r"[IE]\d+", (m.group(2) or "").upper())
                    if m.group(1).lower() == "doubtful" and not codes:
                        errs.append(f"{sid} {j}: doubtful eligibility names no criterion code")
                    elig[j] = (m.group(1).lower(), codes)
            adj = {ac.norm(x["item"]): x for x in rows(f("adjudication.csv"))} if os.path.exists(f("adjudication.csv")) else {}
        except (OSError, KeyError) as e:
            errs.append(f"{sid}: {e}"); continue
        if errs:
            continue

        def settle(item, kind, v1, v2):
            """Return (decision row or None, basis). None means pending."""
            d = adj.get(ac.norm(item))
            if d and ac.norm(d["decision"]) != "escalate":
                return d, "adjudicated"
            if d and a.escalated:
                return d, "escalated"
            pending.append({"study_id": sid, "kind": kind, "item": item, "judge_1": v1, "judge_2": v2,
                            "status": "escalated: needs a person" if d else "needs adjudication"})
            return None, None

        for dom in proto["domains"]:
            r1, r2 = judged["j1"][ac.norm(dom)], judged["j2"][ac.norm(dom)]
            j1, j2 = scale[ac.norm(r1["judgment"])], scale[ac.norm(r2["judgment"])]
            pairs.append((j1, j2))
            base = {"study_id": sid, "instrument": r1["instrument"], "domain": dom}
            if j1 == j2:
                rob_out.append({**base, "judgment": j1, "support_quote": r1["support_quote"],
                                "location": r1["location"], "basis": "agreed"})
                continue
            disagreements.append({"study_id": sid, "domain": dom, "judge_1": j1, "judge_2": j2})
            d, basis = settle(dom, "rating", j1, j2)
            if d is None:
                continue
            if basis == "escalated":
                worse = r1 if rank.get(ac.norm(j1), -1) >= rank.get(ac.norm(j2), -1) else r2
                rob_out.append({**base, "judgment": scale[ac.norm(worse["judgment"])], "support_quote": worse["support_quote"],
                                "location": worse["location"], "basis": "escalated: worse of two"})
                escalated += 1
                decided.append({"study_id": sid, "kind": "rating", "item": dom, "judge_1": j1, "judge_2": j2,
                                "taken": scale[ac.norm(worse["judgment"])], "basis": "escalated"})
            elif ac.norm(d["decision"]) not in scale:
                errs.append(f"{sid} {dom}: adjudicated rating {d['decision']!r} is not on the scale")
            else:
                rob_out.append({**base, "judgment": scale[ac.norm(d["decision"])], "support_quote": d.get("support_quote", ""),
                                "location": d.get("location", ""), "basis": "adjudicated"})
                adjudicated += 1
                decided.append({"study_id": sid, "kind": "rating", "item": dom, "judge_1": j1, "judge_2": j2,
                                "taken": scale[ac.norm(d["decision"])], "basis": "adjudicated"})

        asked = OrderedDict()
        for j in ("j1", "j2"):
            if os.path.exists(f(f"{j}.queries.csv")):
                for q in rows(f(f"{j}.queries.csv")):
                    queries_raised += 1
                    asked.setdefault(q["column"].strip(), []).append(q.get("suggested", "").strip())
        for col, suggested in asked.items():
            if col not in ext:
                errs.append(f"{sid}: a judge queried {col!r}, which is not a column of the extraction row"); continue
            d, basis = settle(col, "extraction", ext[col], " / ".join(dict.fromkeys(suggested)))
            if d is None:
                continue
            if basis == "escalated" or ac.norm(d["decision"]) == "keep":
                kept += 1; escalated += basis == "escalated"
                decided.append({"study_id": sid, "kind": "extraction", "item": col, "extracted": ext[col],
                                "suggested": " / ".join(dict.fromkeys(suggested)), "taken": ext[col], "basis": basis})
                continue
            if col in proto["codes"]:
                ok = {ac.norm(v) for v in proto["codes"][col][1]}
                bad = [v for v in (x.strip() for x in d["decision"].split(";")) if v and ac.norm(v) not in ok]
                if bad:
                    errs.append(f"{sid}: adjudicated {col} = {bad[0]!r} is not in the protocol's list"); continue
            decided.append({"study_id": sid, "kind": "extraction", "item": col, "extracted": ext[col],
                            "suggested": " / ".join(dict.fromkeys(suggested)), "taken": d["decision"].strip(), "basis": "adjudicated"})
            ext[col] = d["decision"].strip(); changed += 1

        (s1, c1), (s2, c2) = elig["j1"], elig["j2"]
        elig_same += s1 == s2
        codes = sorted(set(c1 if s1 == "doubtful" else []) | set(c2 if s2 == "doubtful" else []))
        ext["eligibility"] = "clear" if not codes else "doubtful:" + "/".join(codes)
        ext_out.append(ext)

    if errs:
        print("The judges' files cannot be merged; nothing written:", file=sys.stderr)
        for e in errs:
            print(f"  - {e}", file=sys.stderr)
        return 2
    if pending:
        path = a.pending or os.path.join(a.dir, "pending-adjudication.csv")
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(pending[0]), lineterminator="\n"); w.writeheader(); w.writerows(pending)
        print(f"{len(pending)} item(s) undecided; nothing merged. Listed in {path}:")
        for p in pending:
            print(f"  {p['study_id']}  {p['kind']:10} {p['item']}: {p['judge_1']!r} vs {p['judge_2']!r}  ({p['status']})")
        return 1

    stats = OrderedDict([
        ("studies", len(studies)),
        ("ratings", OrderedDict([("pairs", len(pairs)),
                                 ("raw_agreement", round(sum(x == y for x, y in pairs) / len(pairs), 3) if pairs else None),
                                 ("kappa", kappa(pairs)), ("adjudicated", adjudicated),
                                 ("escalated_taken_as_worse", sum(1 for r in rob_out if r["basis"].startswith("escalated")))])),
        ("eligibility", OrderedDict([("judges_gave_the_same_verdict", elig_same),
                                     ("doubtful_studies", sum(1 for e in ext_out if e["eligibility"] != "clear"))])),
        ("extraction_queries", OrderedDict([("raised", queries_raised), ("changed", changed), ("kept", kept)])),
        ("disagreements", disagreements),
        ("decided", decided),
        ("escalated", [x for x in decided if x["basis"] == "escalated"]),
    ])
    if a.rob:
        with open(a.rob, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["study_id", "instrument", "domain", "judgment", "support_quote", "location", "basis"],
                               lineterminator="\n"); w.writeheader(); w.writerows(rob_out)
    if a.extraction:
        header = list(OrderedDict((k, 1) for e in ext_out for k in e))
        with open(a.extraction, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=header, lineterminator="\n", restval=""); w.writeheader(); w.writerows(ext_out)
    if a.stats:
        open(a.stats, "w", encoding="utf-8").write(json.dumps(stats, indent=2) + "\n")
    r = stats["ratings"]
    print(f"{len(studies)} studies merged. Ratings: {r['pairs']} pairs, raw agreement {r['raw_agreement']}, kappa "
          f"{'undefined (no variation)' if r['kappa'] is None else r['kappa']}; {adjudicated} adjudicated"
          + (f", {r['escalated_taken_as_worse']} escalated and taken as the worse" if r["escalated_taken_as_worse"] else ""))
    print(f"Eligibility: same verdict from both judges on {elig_same} of {len(studies)}; "
          f"{stats['eligibility']['doubtful_studies']} doubtful. Extraction queries: {queries_raised} raised, {changed} changed, {kept} kept.")
    for x in stats["escalated"]:
        print(f"  escalated, for a person: {x['study_id']} {x['item']} taken as {x['taken']!r}"
              + (f" (suggested {x['suggested']!r})" if x["kind"] == "extraction" else f" ({x['judge_1']!r} vs {x['judge_2']!r})"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
