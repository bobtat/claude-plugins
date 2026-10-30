#!/usr/bin/env python3
"""Check every quoted passage in a review's working files against the saved full text.

    python3 verify_quotes.py --fulltext fulltext/ [--map extraction.csv] FILE...

FILE may be a CSV (screener decisions, adjudications, rob.csv) or a Markdown
appraisal. Each quotation must appear in the full text of the record it is
attributed to. Standard library only.

Verdicts per quotation:
  VERIFIED     found in the attributed record's text
  NOT FOUND    in no saved text at all
  TRANSPLANT   absent from the attributed record but present in ANOTHER record's
               text — real words attached to the wrong paper
  UNCHECKABLE  no saved full text for the attributed record

Exits 1 if anything is not VERIFIED (use --allow-uncheckable to tolerate missing
texts), 2 on bad input. A check that silently covered nothing must not pass.

Records are found from a record_id column, from a study_id column expanded with
--map (a CSV with study_id and semicolon-separated report_ids), or in Markdown
from a line such as "- Records: R09, R10".
"""
import argparse, csv, glob, os, re, sys, unicodedata

QUOTE_RES = [
    re.compile(r'"([^"\n]{3,}?)"'),                 # straight double
    re.compile(r'“([^”\n]{3,}?)”'),  # curly double
    # single quotes only when they cannot be an apostrophe: opened after
    # start/space/punctuation and closed before space/punctuation/end
    re.compile(r"(?:(?<=^)|(?<=[\s(\[:]))'([^'\n]{8,}?)'(?=[\s.,;:)\]]|$)"),
]
SPLIT_RE = re.compile(r'\s*(?:\.\.\.|…|\[\s*\.\.\.\s*\]|\[[^\]]{0,60}\])\s*')
CITE_RE = re.compile(r'\[\d+(?:\s*[,–-]\s*\d+)*\]')


def normalize(s):
    s = unicodedata.normalize("NFKC", s).replace("­", "")
    s = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", s)          # line-break hyphenation
    s = s.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"[‐-―−]", "-", s)
    s = CITE_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def fragments(quote, min_words):
    out = []
    for frag in SPLIT_RE.split(quote):
        f = normalize(frag).strip(" .,;:!?()'\"")
        if len(f.split()) >= 2:
            out.append(f)
    return out if sum(len(f.split()) for f in out) >= min_words else []


def quotes_in(text, min_words):
    seen = []
    for rx in QUOTE_RES:
        for m in rx.finditer(text):
            q = m.group(1).strip()
            if fragments(q, min_words) and q not in seen:
                seen.append(q)
    return seen


def load_texts(d):
    texts = {}
    for p in glob.glob(os.path.join(d, "*.txt")):
        with open(p, encoding="utf-8", errors="replace") as f:
            texts[os.path.splitext(os.path.basename(p))[0]] = normalize(f.read())
    return texts


def load_map(path):
    m = {}
    if path:
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                ids = [x.strip() for x in re.split(r"[;,]", r.get("report_ids", "")) if x.strip()]
                m[r["study_id"]] = ids or [r["study_id"]]
    return m


def items_from(path, smap, min_words):
    """Yield (location, [record ids], quote)."""
    if path.endswith(".csv"):
        with open(path, newline="", encoding="utf-8") as f:
            for n, row in enumerate(csv.DictReader(f), start=2):
                if row.get("record_id"):
                    ids = [row["record_id"].strip()]
                elif row.get("study_id"):
                    ids = smap.get(row["study_id"].strip(), [row["study_id"].strip()])
                else:
                    continue
                for col, val in row.items():
                    if col in ("record_id", "study_id") or not val:
                        continue
                    for q in quotes_in(val, min_words):
                        yield f"{path}:{n}:{col}", ids, q
    else:
        text = open(path, encoding="utf-8", errors="replace").read()
        m = re.search(r"^\s*[-*]?\s*Records?:\s*(.+)$", text, re.M | re.I)
        if not m:
            raise ValueError(f"{path}: no 'Records:' line naming the records this file quotes")
        ids = [x.strip(" `") for x in re.split(r"[;,]", m.group(1)) if x.strip(" `")]
        for i, line in enumerate(text.splitlines(), start=1):
            for q in quotes_in(line, min_words):
                yield f"{path}:{i}", ids, q


def judge(ids, quote, texts, min_words):
    frags = fragments(quote, min_words)
    have = [i for i in ids if i in texts]
    if not have:
        return "UNCHECKABLE", ""
    if any(all(f in texts[i] for f in frags) for i in have):
        return "VERIFIED", ""
    elsewhere = [k for k, t in texts.items() if k not in ids and all(f in t for f in frags)]
    if elsewhere:
        return "TRANSPLANT", "found in " + ", ".join(sorted(elsewhere))
    return "NOT FOUND", ""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--fulltext", required=True, help="directory of <record_id>.txt files")
    ap.add_argument("--map", help="CSV mapping study_id to report_ids (e.g. extraction.csv)")
    ap.add_argument("--min-words", type=int, default=4, help="ignore quotations shorter than this")
    ap.add_argument("--allow-uncheckable", action="store_true")
    ap.add_argument("--report", help="also write a Markdown report here")
    a = ap.parse_args()

    texts = load_texts(a.fulltext)
    smap = load_map(a.map)
    rows, counts = [], {"VERIFIED": 0, "NOT FOUND": 0, "TRANSPLANT": 0, "UNCHECKABLE": 0}
    try:
        for path in a.files:
            for loc, ids, q in items_from(path, smap, a.min_words):
                v, note = judge(ids, q, texts, a.min_words)
                counts[v] += 1
                rows.append((v, loc, ";".join(ids), q, note))
    except (ValueError, KeyError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    for v, loc, ids, q, note in rows:
        if v != "VERIFIED":
            short = q if len(q) <= 90 else q[:87] + "..."
            print(f"{v:11}  {ids:14}  \"{short}\"  {note}  ({loc})")
    print(f"\n{len(rows)} quotations checked against {len(texts)} saved texts: " +
          ", ".join(f"{k.lower()} {v}" for k, v in counts.items()))

    if a.report:
        with open(a.report, "w", encoding="utf-8") as f:
            f.write("# Quote verification\n\n| Verdict | Records | Quotation | Note | Where |\n|---|---|---|---|---|\n")
            for v, loc, ids, q, note in rows:
                f.write(f"| {v} | {ids} | {q.replace('|', '/')} | {note} | `{loc}` |\n")
            f.write(f"\n{len(rows)} quotations; " + ", ".join(f"{k.lower()} {v}" for k, v in counts.items()) + ".\n")

    bad = counts["NOT FOUND"] + counts["TRANSPLANT"] + (0 if a.allow_uncheckable else counts["UNCHECKABLE"])
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
