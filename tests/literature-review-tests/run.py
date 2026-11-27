#!/usr/bin/env python3
"""Checks for plugins/literature-review. Standard library only.

    python tests/literature-review-tests/run.py        # from anywhere
    python tests/literature-review-tests/run.py -v     # print every check

Two kinds of check. The plugin's eight scripts are run against their fixtures and
against inputs they must refuse, with the expected numbers written here. The
Markdown is checked for the repository's rules: manifests that agree, namespaced
references that resolve, and command files with no shell expansion.

Exits 1 if anything fails.
"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PLUGIN = os.path.join(ROOT, "plugins", "literature-review")
SK = os.path.join(PLUGIN, "skills")
VERIFY = os.path.join(SK, "literature-review", "scripts", "verify_quotes.py")
FETCH = os.path.join(SK, "record-screening", "scripts", "fetch_fulltext.py")
STATS = os.path.join(SK, "record-screening", "scripts", "screening_stats.py")
FLOW = os.path.join(SK, "review-figures", "scripts", "prisma_flow.py")
FIGCHECK = os.path.join(SK, "review-figures", "scripts", "check_figure.py")
APPRAISAL = os.path.join(SK, "source-appraisal", "scripts", "appraisal_check.py")
MERGE = os.path.join(SK, "source-appraisal", "scripts", "appraisal_merge.py")
TRACE = os.path.join(SK, "review-synthesis", "scripts", "trace_numbers.py")
APP = os.path.join(SK, "source-appraisal", "examples")
NT = os.path.join(SK, "review-synthesis", "examples", "number-trace")
QC = os.path.join(SK, "literature-review", "examples")
SCR = os.path.join(SK, "record-screening", "examples")

VERBOSE = "-v" in sys.argv[1:]
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    if VERBOSE or not ok:
        print(("  ok    " if ok else "  FAIL  ") + name + (f"\n          {detail}" if detail and not ok else ""))


def run(script, *args, cwd=None):
    p = subprocess.run([sys.executable, script, *args], cwd=cwd, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def frontmatter(path):
    m = re.match(r"---\r?\n(.*?)\r?\n---\r?\n", read(path), re.S)
    return None if not m else [l.split(":")[0] for l in m.group(1).splitlines() if re.match(r"^[a-z-]+:", l)]


def md_files():
    for d, _, fs in os.walk(PLUGIN):
        for f in fs:
            if f.endswith(".md"):
                yield os.path.join(d, f)


# ---------------------------------------------------------------- manifests
def manifests():
    pj = json.loads(read(os.path.join(PLUGIN, ".claude-plugin", "plugin.json")))
    mp = json.loads(read(os.path.join(ROOT, ".claude-plugin", "marketplace.json")))
    entry = [p for p in mp["plugins"] if p["name"] == "literature-review"]
    check("marketplace.json lists the plugin once", len(entry) == 1)
    if entry:
        check("version matches between marketplace.json and plugin.json",
              entry[0]["version"] == pj["version"], f"{entry[0]['version']} vs {pj['version']}")
        check("description matches between marketplace.json and plugin.json",
              entry[0]["description"] == pj["description"])
    check("root README has the plugin's row", "(plugins/literature-review)" in read(os.path.join(ROOT, "README.md")))


# ---------------------------------------------------------------- markdown rules
def markdown():
    skills = sorted(os.listdir(SK))
    agents = sorted(f[:-3] for f in os.listdir(os.path.join(PLUGIN, "agents")) if f.endswith(".md"))
    cmds = sorted(f[:-3] for f in os.listdir(os.path.join(PLUGIN, "commands")) if f.endswith(".md"))
    names = set(skills) | set(agents) | set(cmds)

    need = {"agents": ["name", "description", "tools", "model"],
            "commands": ["description", "argument-hint", "allowed-tools"],
            "skills": ["name", "description"]}
    targets = ([("agents", os.path.join(PLUGIN, "agents", a + ".md")) for a in agents]
               + [("commands", os.path.join(PLUGIN, "commands", c + ".md")) for c in cmds]
               + [("skills", os.path.join(SK, s, "SKILL.md")) for s in skills])
    for kind, path in targets:
        keys = frontmatter(path)
        miss = None if keys is None else [k for k in need[kind] if k not in keys]
        check(f"frontmatter: {os.path.relpath(path, PLUGIN)}", keys is not None and not miss,
              "no frontmatter" if keys is None else f"missing {miss}")

    unresolved, bare = [], []
    for path in md_files():
        rel = os.path.relpath(path, PLUGIN)
        for n, line in enumerate(read(path).splitlines(), start=1):
            for ref in re.findall(r"literature-review:([a-z-]+)", line):
                if ref not in names:
                    unresolved.append(f"{rel}:{n} literature-review:{ref}")
            if line.startswith("name:"):
                continue
            for name in set(skills) | set(agents):
                if re.search(r"(^|[^:a-z-])`" + re.escape(name) + r"`", line):
                    bare.append(f"{rel}:{n} `{name}`")
    check("every literature-review:<name> reference resolves", not unresolved, "; ".join(unresolved[:5]))
    check("no skill or agent is referred to by a bare backticked name", not bare, "; ".join(bare[:5]))

    expanding = []
    for c in cmds:
        for n, line in enumerate(read(os.path.join(PLUGIN, "commands", c + ".md")).splitlines(), start=1):
            if (line.startswith("!") or "`!" in line) and re.search(r"\$|~/", line):
                expanding.append(f"{c}.md:{n}")
    check("no shell expansion in a command's ! block", not expanding, "; ".join(expanding))


# ---------------------------------------------------------------- verify_quotes.py
def quotes():
    d = os.path.join(QC, "quote-check")
    rc, out, _ = run(VERIFY, "--fulltext", "fulltext", "--map", "extraction.csv",
                     "decisions.csv", "rob.csv", os.path.join("appraisals", "S2.md"), cwd=d)
    check("quote-check fixture: 12 quotations, 9 verified, 1 not found, 1 transplant, 1 uncheckable",
          "12 quotations checked against 2 saved texts: verified 9, not found 1, transplant 1, uncheckable 1" in out, out[-200:])
    check("quote-check fixture exits 1", rc == 1, f"exit {rc}")
    check("a transplant names the paper the words came from", re.search(r"TRANSPLANT.*found in R\d", out) is not None)

    d = os.path.join(QC, "own-words")
    rc, out, _ = run(VERIFY, "--fulltext", "fulltext", "--own", "protocol.md", "appraisal.md", cwd=d)
    check("own-words fixture: verified 1, not found 1, own words 1",
          "verified 1, not found 1, transplant 0, uncheckable 0, own words 1" in out, out[-200:])
    check("a quotation after a one-letter quoted code is still checked",
          "the attack succeeded in nearly every trial we ran" in out, out[-300:])
    rc, out, _ = run(VERIFY, "--fulltext", "fulltext", "appraisal.md", cwd=d)
    check("without --own the protocol's wording is not found", "verified 1, not found 2" in out, out[-200:])

    d = os.path.join(QC, "dotted-id")
    rc, _, err = run(VERIFY, "--fulltext", "fulltext", "ft.csv", cwd=d)
    check("a record ID with a dot is refused (exit 2)", rc == 2 and "record ID" in err, f"exit {rc}: {err[-200:]}")

    with tempfile.TemporaryDirectory() as t:
        open(os.path.join(t, "norec.md"), "w").write('No records line.\n\n"some quoted words that are long enough"\n')
        rc, _, err = run(VERIFY, "--fulltext", os.path.join(QC, "quote-check", "fulltext"), os.path.join(t, "norec.md"))
        check("a Markdown file naming no records is refused (exit 2)", rc == 2, f"exit {rc}")


# ---------------------------------------------------------------- fetch_fulltext.py
def fetch():
    with tempfile.TemporaryDirectory() as t:
        out = os.path.join(t, "ft")
        rc, _, err = run(FETCH, os.path.join(SCR, "records.csv"), "R01", "ax-2609.29647",
                         "--out", out, "--log", os.path.join(t, "log.csv"))
        check("fetch_fulltext refuses a dotted record ID before fetching anything",
              rc == 2 and not os.path.exists(out), f"exit {rc}: {err[-160:]}")


# ---------------------------------------------------------------- screening_stats.py and the flow
def stats_and_flow():
    with tempfile.TemporaryDirectory() as t:
        pf = os.path.join(t, "prisma-flow.json")
        rc, _, err = run(STATS, "records.csv", "screening.csv", "--protocol", "protocol.md", "--out", pf, cwd=SCR)
        check("screening fixture derives counts (exit 0)", rc == 0, err[-300:])
        if rc == 0:
            d = json.loads(read(pf))
            a = d["screening_agreement"]
            check("kappa: 0.533 at title/abstract, 0.769 at full text",
                  a["title_abstract"]["kappa"] == 0.533 and a["full_text"]["kappa"] == 0.769, str(a))
            check("exclusion reasons are rendered from the protocol, sub-codes rolled up",
                  d["excluded_with_reasons"] == {"E2: Not adults": 2, "E3: Not primary research": 1},
                  str(d["excluded_with_reasons"]))
            check("doubtful inclusions are counted by criterion",
                  d.get("eligibility_doubt", {}).get("by_criterion") == {"I2": 1}, str(d.get("eligibility_doubt")))
            check("one study with two reports: 5 reports of 4 studies",
                  (d["included_reports"], d["included_studies"]) == (5, 4),
                  f"{d['included_reports']} reports, {d['included_studies']} studies")

            svg = os.path.join(t, "flow.svg")
            rc, _, err = run(FLOW, pf, "--out", svg)
            check("the flow diagram draws from the derived counts", rc == 0 and os.path.exists(svg), err[-300:])
            rc, out, _ = run(FIGCHECK, svg)
            check("the drawn flow diagram passes check_figure", rc == 0, out[-400:])

            bad = dict(d); bad["screened"] = d["screened"] + 7
            bp = os.path.join(t, "bad.json"); open(bp, "w").write(json.dumps(bad))
            bsvg = os.path.join(t, "bad.svg")
            rc, _, _ = run(FLOW, bp, "--out", bsvg)
            check("a flow whose arithmetic does not close is not drawn", rc != 0 and not os.path.exists(bsvg), f"exit {rc}")

        screening = read(os.path.join(SCR, "screening.csv"))
        for label, old, new in [
            ("an exclusion citing an inclusion code is refused", "E2(a): neonates", "I2: neonates"),
            ("a doubt naming no criterion is refused", "I2: clinic staff", "clinic staff"),
        ]:
            if old not in screening:
                check(label, False, f"fixture no longer contains {old!r}")
                continue
            p = os.path.join(t, "s.csv"); open(p, "w", encoding="utf-8").write(screening.replace(old, new))
            rc, _, _ = run(STATS, os.path.join(SCR, "records.csv"), p,
                           "--protocol", os.path.join(SCR, "protocol.md"), "--out", os.path.join(t, "x.json"))
            check(label, rc == 2, f"exit {rc}")

    example = os.path.join(SK, "review-figures", "examples", "prisma-flow.svg")
    rc, out, _ = run(FIGCHECK, example)
    check("the shipped example flow diagram passes check_figure", rc == 0, out[-300:])


# ---------------------------------------------------------------- appraisal_check.py
def appraisal():
    rc, out, err = run(APPRAISAL, "--protocol", "protocol.md", "--extraction", "extraction.csv",
                       "--rob", "rob.csv", cwd=APP)
    check("appraisal fixture passes: 3 studies, 2 coded columns, 3 domains",
          rc == 0 and "3 studies, 2 coded columns" in out and "3 studies x 3 domains" in out, out + err[-300:])
    check("overall is the worst domain: Some concerns 1, High 1, No information 1",
          "overall (worst domain): Some concerns 1, High 1, No information 1" in out, out)
    with tempfile.TemporaryDirectory() as t:
        rob = read(os.path.join(APP, "rob.csv")); ext = read(os.path.join(APP, "extraction.csv"))
        p = os.path.join(t, "rob.csv"); open(p, "w", encoding="utf-8").write(rob)
        rc, _, _ = run(APPRAISAL, "--protocol", os.path.join(APP, "protocol.md"), "--rob", p, "--derive-overall")
        once = read(p)
        check("--derive-overall writes one derived Overall row per study",
              rc == 0 and once.count(",Overall,") == 3 and "S1,Structured critique,Overall,High,,derived: worst domain" in once, once[-300:])
        run(APPRAISAL, "--protocol", os.path.join(APP, "protocol.md"), "--rob", p, "--derive-overall")
        check("deriving twice changes nothing", read(p) == once)

        def refused(label, kind, text):
            q = os.path.join(t, kind + "-bad.csv"); open(q, "w", encoding="utf-8").write(text)
            rc, _, err = run(APPRAISAL, "--protocol", os.path.join(APP, "protocol.md"), "--" + kind, q)
            check(label, rc == 2, f"exit {rc}: {err[-200:]}")
        refused("a coded value outside its list is refused", "extraction", ext.replace("direct write,GPT-4\n", "write access,GPT-4\n"))
        refused("two values in a single-value column are refused", "extraction", ext.replace(",attack,direct", ",attack; defence,direct"))
        refused("an empty coded cell is refused", "extraction", ext.replace(",benchmark,Not stated,", ",benchmark,,"))
        refused("a judgment off the scale is refused", "rob", rob.replace(",Low,\"code", ",Moderate,\"code"))
        refused("an overall row a reader wrote is refused", "rob", rob + "S1,Structured critique,Overall,High,,\n")
        refused("a study missing a domain is refused", "rob", "\n".join(l for l in rob.splitlines() if not l.startswith("S2,Structured critique,D2")) + "\n")
        bare = os.path.join(t, "protocol.md"); open(bare, "w").write("# Protocol\n\n## 7. Data items\nfree text only\n")
        rc, _, _ = run(APPRAISAL, "--protocol", bare, "--rob", os.path.join(APP, "rob.csv"))
        check("a protocol with no code lists or scale is refused", rc == 2, f"exit {rc}")


# ---------------------------------------------------------------- appraisal_merge.py
def merge():
    import shutil
    src, proto = os.path.join(APP, "merge"), os.path.join(APP, "protocol.md")
    with tempfile.TemporaryDirectory() as t:
        def go(d, *extra):
            return run(MERGE, "--protocol", proto, "--dir", d, "--rob", os.path.join(t, "rob.csv"),
                       "--extraction", os.path.join(t, "extraction.csv"), "--stats", os.path.join(t, "stats.json"), *extra)
        rc, out, err = go(src)
        check("merge fixture: 2 studies, 6 pairs, raw agreement 0.833, kappa 0.75, 1 adjudicated",
              rc == 0 and "6 pairs, raw agreement 0.833, kappa 0.75; 1 adjudicated" in out, out + err[-300:])
        if rc == 0:
            rob, ext = read(os.path.join(t, "rob.csv")), read(os.path.join(t, "extraction.csv"))
            st = json.loads(read(os.path.join(t, "stats.json")))
            check("an agreed rating is kept and marked agreed", "S1,Structured critique,D1 Baseline adequacy,Some concerns," in rob and rob.count(",agreed") == 5, rob)
            check("a disputed rating takes the adjudicator's decision", "S2,Structured critique,D1 Baseline adequacy,High," in rob and rob.count(",adjudicated") == 1, rob)
            check("an adjudicated extraction query changes the value", "S2,R2,A,both," in ext, ext)
            check("a study either judge doubts is doubtful; agreement does not clear it",
                  ext.strip().splitlines()[1].endswith(",clear") and ext.strip().endswith(",doubtful:I4"), ext)
            check("the statistics record the disagreement and the query",
                  st["disagreements"] == [{"study_id": "S2", "domain": "D1 Baseline adequacy", "judge_1": "Some concerns", "judge_2": "High"}]
                  and st["extraction_queries"] == {"raised": 1, "changed": 1, "kept": 0}, str(st))
            rc2, out2, _ = run(APPRAISAL, "--protocol", proto, "--extraction", os.path.join(t, "extraction.csv"),
                               "--rob", os.path.join(t, "rob.csv"), "--derive-overall")
            check("the merged files pass the appraisal check and derive overall ratings", rc2 == 0 and "overall (worst domain): High 2" in out2, out2)

        d = os.path.join(t, "pending"); shutil.copytree(src, d); os.remove(os.path.join(d, "S2.adjudication.csv"))
        for f in ("rob.csv", "extraction.csv"):
            if os.path.exists(os.path.join(t, f)): os.remove(os.path.join(t, f))
        rc, out, _ = go(d)
        check("undecided items stop the merge (exit 1) and are listed", rc == 1 and "2 item(s) undecided" in out
              and os.path.exists(os.path.join(d, "pending-adjudication.csv")) and not os.path.exists(os.path.join(t, "rob.csv")), out)

        d = os.path.join(t, "esc"); shutil.copytree(src, d)
        adj = read(os.path.join(d, "S2.adjudication.csv")).replace("S2,D1 Baseline adequacy,High,", "S2,D1 Baseline adequacy,escalate,")
        open(os.path.join(d, "S2.adjudication.csv"), "w", encoding="utf-8").write(adj)
        rc, out, _ = go(d)
        check("an escalated rating stays undecided without --escalated", rc == 1 and "escalated: needs a person" in out, out)
        rc, out, _ = go(d, "--escalated", "worse")
        check("--escalated worse takes the more severe rating and marks it",
              rc == 0 and "S2,Structured critique,D1 Baseline adequacy,High," in read(os.path.join(t, "rob.csv"))
              and "escalated: worse of two" in read(os.path.join(t, "rob.csv")), out)

        def refused(label, name, old, new):
            d = tempfile.mkdtemp(dir=t); os.rmdir(d); shutil.copytree(src, d)
            txt = read(os.path.join(d, name)); assert old in txt, (name, old)
            open(os.path.join(d, name), "w", encoding="utf-8").write(txt.replace(old, new))
            rc, _, err = go(d)
            check(label, rc == 2, f"exit {rc}: {err[-200:]}")
        refused("a judgment with no eligibility line is refused", "S1.j1.md", "- Eligibility: clear", "- Eligible")
        refused("a doubt with no criterion code is refused", "S2.j2.md", "doubtful:I4", "doubtful")
        refused("an adjudicated rating off the scale is refused", "S2.adjudication.csv", "S2,D1 Baseline adequacy,High,", "S2,D1 Baseline adequacy,Severe,")
        refused("an adjudicated code outside its list is refused", "S2.adjudication.csv", "S2,contribution,both,", "S2,contribution,attack and defence,")
        refused("a judge's rating off the scale is refused", "S2.j2.rob.csv", ",High,", ",Critical,")


# ---------------------------------------------------------------- trace_numbers.py
def trace():
    rc, out, _ = run(TRACE, "--fulltext", "fulltext", "--keys", "study-keys.csv", "review.md", cwd=NT)
    check("number-trace fixture: 12 numbers, 9 traced, 2 not in source, 1 uncheckable, 1 computed",
          "12 numbers traced against 2 saved texts: traced 9, not in source 2, uncheckable 1; 1 marked computed" in out, out[-300:])
    check("number-trace fixture exits 1", rc == 1, f"exit {rc}")
    check("a number from an uncited study names the study it is in",
          re.search(r"NOT IN SOURCE\s+7\.92\s+@liu2026rerun.*is in @chen2024attack", out) is not None, out)
    check("a number in no saved text is reported with no source", re.search(r"NOT IN SOURCE\s+44\.0\s+@chen2024attack\s+line \d+\s*$", out, re.M) is not None, out)
    check("years, model names, table references and small integers are not traced",
          not re.search(r"(NOT IN SOURCE|UNCHECKABLE)\s+(2026|5|2|250)\b", out), out)
    with tempfile.TemporaryDirectory() as t:
        k = os.path.join(t, "k.csv"); open(k, "w").write("key,reports\nx,R1\n")
        rc, _, _ = run(TRACE, "--fulltext", os.path.join(NT, "fulltext"), "--keys", k, os.path.join(NT, "review.md"))
        check("a keys file without citekey and report_ids columns is refused", rc == 2, f"exit {rc}")


# ---------------------------------------------------------------- check_figure.py
SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" role="img" aria-labelledby="t d">'
       '<title id="t">Test</title><desc id="d">Two labels, 3 and 4.</desc>'
       '<style>.l{font:12px sans-serif;fill:#44506b}</style>%s</svg>')


def figures():
    with tempfile.TemporaryDirectory() as t:
        cases = [
            ("labels that run into each other fail", 1,
             '<text class="l" x="230" y="50" text-anchor="end">Count L / S / H / N</text>'
             '<text class="l" x="260" y="50" text-anchor="middle">0/30/22/0</text>'),
            ("labels with room between them pass", 0,
             '<text class="l" x="200" y="50" text-anchor="end">Count L / S / H / N</text>'
             '<text class="l" x="300" y="50" text-anchor="middle">0/30/22/0</text>'),
            ("a white fill on a mark fails", 1,
             '<text class="l" x="20" y="50">Label 3</text><rect x="100" y="20" width="20" height="20" fill="white"/>'),
        ]
        for name, want, body in cases:
            p = os.path.join(t, "f.svg"); open(p, "w", encoding="utf-8").write(SVG % body)
            rc, out, _ = run(FIGCHECK, p)
            check("check_figure: " + name, rc == want, f"exit {rc}: {out[-200:]}")


def main():
    for section in (manifests, markdown, quotes, fetch, stats_and_flow, appraisal, merge, trace, figures):
        if VERBOSE:
            print(section.__name__)
        section()
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)} of {len(results)} checks passed" + ("" if not failed else f"; {len(failed)} FAILED"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
