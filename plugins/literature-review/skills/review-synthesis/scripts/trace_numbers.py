#!/usr/bin/env python3
"""Trace every number a review attributes to a study back to that study's saved text.

    python3 trace_numbers.py --fulltext fulltext/ --keys study-keys.csv review.md

A number is attributed to a study when it shares a sentence, or a table row, with
that study's citation key (@smith2024). It must then appear, digit for digit, in
the saved full text of one of the studies cited there. Standard library only.

Verdicts per number:
  TRACED         in the saved text of a study cited beside it
  NOT IN SOURCE  in none of them; the note names the studies whose text does have it,
                 which is usually the study that should have been cited
  UNCHECKABLE    none of the cited studies has a saved text

Checked: numbers with a decimal point, percentages, and integers of 100 or more.
Skipped: small whole numbers (in every paper, so finding one proves nothing), years,
numbers inside names (GPT-5, Llama3.1-8B), and references to a place in the paper
(Table 2, §4.1, Fig. 3). A number marked as the review's own arithmetic, written
`[computed: 0.47]`, is skipped and listed.

--keys is a CSV with citekey and report_ids columns (record IDs, semicolon-separated).
A report's text is fulltext/<record_id>.txt plus any <record_id>.<part>.txt.

Exits 1 if any number is NOT IN SOURCE, 2 on bad input. It confirms the digits are in
the paper. It does not confirm they mean what the sentence says they mean.
"""
import argparse, csv, glob, os, re, sys, unicodedata

KEY_RE = re.compile(r"@([A-Za-z][\w+-]*(?::[\w+-]+)*)")
NUM_RE = re.compile(r"(?<![\w.])(?<![A-Za-z]-)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\s?%)?(?![\w]|\.\d|-[A-Za-z])")
PLACE_RE = re.compile(r"(?:§+|\b(?:Tables?|Tab\.|Figures?|Figs?\.|Sections?|Sec\.|Appendix|App\.|Eqs?\.|"
                      r"Equations?|Algorithms?|Alg\.|pp?\.|pages?|Steps?|Chapters?)\s*)[\dA-Z]+(?:[.\-–]\d+)*", re.I)
COMPUTED_RE = re.compile(r"\[computed:[^\]]*\]", re.I)
SENT_RE = re.compile(r"(?<=[.!?])[\"')\]*_]*\s+(?=[\"'(\[*_]*[A-Z@])")


def norm(s):
    s = unicodedata.normalize("NFKC", s)
    return re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", s)      # 1,157 -> 1157


def load_texts(d):
    texts = {}
    for p in sorted(glob.glob(os.path.join(d, "*.txt"))):
        rid = os.path.basename(p)[:-4].partition(".")[0]
        with open(p, encoding="utf-8", errors="replace") as f:
            texts[rid] = texts.get(rid, "") + " " + norm(f.read())
    return texts


def load_keys(path):
    keys = {}
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        if not {"citekey", "report_ids"} <= set(r.fieldnames or []):
            raise ValueError(f"{path}: needs citekey and report_ids columns")
        for row in r:
            keys[row["citekey"].strip()] = [x.strip() for x in re.split(r"[;,]", row["report_ids"]) if x.strip()]
    return keys


def units(text):
    """Yield (line number, unit): a table row, or one sentence of a paragraph."""
    para, start, fenced = [], 0, False
    def flush():
        if para:
            for s in SENT_RE.split(" ".join(para)):
                if s.strip():
                    yield start, s.strip()
    for n, line in enumerate(text.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            fenced = not fenced
            yield from flush(); para = []
            continue
        if fenced:
            continue
        if line.lstrip().startswith("|"):
            yield from flush(); para = []
            if not re.fullmatch(r"[\s|:\-]+", line):
                yield n, line.strip()
        elif not line.strip() or line.lstrip().startswith("#"):
            yield from flush(); para = []
        else:
            if not para:
                start = n
            para.append(line.strip())
    yield from flush()


def numbers(unit):
    """(as written, digits to look for) for each number worth tracing, and the computed ones."""
    computed = COMPUTED_RE.findall(unit)
    s = COMPUTED_RE.sub(" ", unit)
    s = KEY_RE.sub(" ", s)
    s = PLACE_RE.sub(" ", s)
    out = []
    for m in NUM_RE.finditer(norm(s)):
        whole, frac, pct = m.group(1), m.group(2) or "", m.group(3)
        if not frac and not pct:
            v = int(whole)
            if v < 100 or 1900 <= v <= 2100:
                continue
        out.append((m.group(0).strip(), whole + frac))
    return out, computed


def present(digits, text):
    pat = r"(?<![\d.])" + re.escape(digits) + r"(?!\d|\.\d)"
    if re.search(pat, text):
        return True
    if digits.startswith("0."):                        # .938 for 0.938
        return re.search(r"(?<![\d])" + re.escape(digits[1:]) + r"(?!\d)", text) is not None
    return False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("review")
    ap.add_argument("--fulltext", required=True)
    ap.add_argument("--keys", required=True, help="CSV with citekey and report_ids columns")
    ap.add_argument("--report", help="also write a Markdown report here")
    a = ap.parse_args()
    try:
        texts, keys = load_texts(a.fulltext), load_keys(a.keys)
        review = open(a.review, encoding="utf-8").read()
    except (OSError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    owner = {r: k for k, rs in keys.items() for r in rs}
    rows, counts, unknown, computed_all = [], {"TRACED": 0, "NOT IN SOURCE": 0, "UNCHECKABLE": 0}, set(), []
    for line, unit in units(review):
        cited = KEY_RE.findall(unit)
        unknown.update(k for k in cited if k not in keys)
        cited = [k for k in cited if k in keys]
        if not cited:
            continue
        nums, computed = numbers(unit)
        computed_all += [(line, c) for c in computed]
        ids = [r for k in cited for r in keys[k]]
        have = [r for r in ids if r in texts]
        for shown, digits in nums:
            if not have:
                v, note = "UNCHECKABLE", ""
            elif any(present(digits, texts[r]) for r in have):
                v, note = "TRACED", ""
            else:
                other = [r for r, t in sorted(texts.items()) if r not in ids and present(digits, t)]
                named = sorted({"@" + owner[r] for r in other if r in owner})
                rest = [r for r in other if r not in owner]
                v, note = "NOT IN SOURCE", ("is in " + ", ".join((named + rest)[:4])) if other else ""
            counts[v] += 1
            rows.append((v, line, ";".join(dict.fromkeys(cited)), shown, note, unit))

    for v, line, cited, shown, note, unit in rows:
        if v != "TRACED":
            print(f"{v:14} {shown:>10}  @{cited}  line {line}  {note}")
    for k in sorted(unknown):
        print(f"warning: @{k} is not in {a.keys}", file=sys.stderr)
    print(f"\n{len(rows)} numbers traced against {len(texts)} saved texts: "
          + ", ".join(f"{k.lower()} {v}" for k, v in counts.items())
          + (f"; {len(computed_all)} marked computed" if computed_all else ""))

    if a.report:
        with open(a.report, "w", encoding="utf-8") as f:
            f.write("# Number trace\n\n| Verdict | Number | Cited | Line | Note | Context |\n|---|---|---|---|---|---|\n")
            for v, line, cited, shown, note, unit in rows:
                if v != "TRACED":
                    ctx = unit.replace("|", "/")
                    f.write(f"| {v} | {shown} | {cited} | {line} | {note} | {ctx[:160]} |\n")
            f.write(f"\n{len(rows)} numbers; " + ", ".join(f"{k.lower()} {v}" for k, v in counts.items()) + ".\n")
            if computed_all:
                f.write("\nMarked as the review's own arithmetic, not traced:\n\n")
                f.writelines(f"- line {line}: `{c}`\n" for line, c in computed_all)
    return 1 if counts["NOT IN SOURCE"] else 0


if __name__ == "__main__":
    sys.exit(main())
