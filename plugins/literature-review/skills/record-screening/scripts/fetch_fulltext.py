#!/usr/bin/env python3
"""Fetch each record's open-access full text once and save it as plain text.

    python3 fetch_fulltext.py records.csv ID [ID ...] --out fulltext/ --log retrieval.csv

Screeners, the adjudicator and appraisal readers all read the saved copy, so every
quotation can later be checked against the exact text that was read, and nobody
fetches the same paper three times. Standard library only.

Routes, tested: arXiv HTML rendering (arxiv.org/html/<id>) for records with an
arXiv ID; Europe PMC full-text XML for open-access PubMed records. A record with
neither is logged as not retrieved by this script, for an agent to try by hand.

Each saved text is checked against the record's title. A fetch whose text does not
carry the title is NOT saved: getting the wrong paper is the failure this whole
plugin is built against.
"""
import argparse, csv, html, json, os, re, sys, time, urllib.parse, urllib.request

UA = "literature-review-plugin/0.1 (systematic review tooling)"


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8", errors="replace")


def strip_markup(s):
    s = re.sub(r"(?is)<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?i)<(br|/p|/div|/li|/h\d|/tr|/title|/sec)[^>]*>", "\n", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t\r\f\v]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n\n", s)
    return s.strip()


def title_matches(title, text, window=6000):
    words = [w for w in re.findall(r"[a-z0-9]+", title.lower()) if len(w) > 2]
    if not words:
        return False
    head = " ".join(re.findall(r"[a-z0-9]+", text[:window].lower()))
    hit = sum(1 for w in words if re.search(r"\b" + re.escape(w) + r"\b", head))
    return hit / len(words) >= 0.7


def via_arxiv(aid):
    aid = re.sub(r"v\d+$", "", aid.strip())
    code, body = get(f"https://arxiv.org/html/{aid}")
    if code != 200 or "ltx_document" not in body and "ltx_page_main" not in body:
        return None, f"arxiv-html:{code}:no-html-rendering"
    return strip_markup(body), "arxiv-html"


def via_europepmc(pmid):
    q = urllib.parse.quote(f"EXT_ID:{pmid} AND SRC:MED")
    _, body = get(f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}&format=json&resultType=lite")
    res = json.loads(body).get("resultList", {}).get("result", [])
    if not res or not res[0].get("pmcid") or res[0].get("isOpenAccess") != "Y":
        return None, "europepmc:not-open-access"
    pmcid = res[0]["pmcid"]
    code, xml = get(f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML")
    if code != 200 or "<article" not in xml:
        return None, f"europepmc:{code}:no-xml"
    return strip_markup(xml), f"europepmc:{pmcid}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("records")
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--log", required=True, help="CSV appended with one row per record")
    ap.add_argument("--pause", type=float, default=3.0, help="seconds between arXiv requests")
    a = ap.parse_args()

    with open(a.records, newline="", encoding="utf-8") as f:
        recs = {r["record_id"]: r for r in csv.DictReader(f)}
    os.makedirs(a.out, exist_ok=True)
    new_log = not os.path.exists(a.log)
    got = 0
    with open(a.log, "a", newline="", encoding="utf-8") as lf:
        w = csv.writer(lf)
        if new_log:
            w.writerow(["record_id", "full_text_retrieved", "route", "title_match", "chars", "note"])
        for rid in a.ids:
            r = recs.get(rid)
            if r is None:
                w.writerow([rid, "no", "", "", 0, "not in records.csv"]); continue
            path = os.path.join(a.out, f"{rid}.txt")
            if os.path.exists(path):
                w.writerow([rid, "yes", "already saved", "", os.path.getsize(path), "kept existing copy"]); got += 1; continue
            text, route, note = None, "", ""
            try:
                if r.get("arxiv_id"):
                    text, route = via_arxiv(r["arxiv_id"]); time.sleep(a.pause)
                if text is None and r.get("pmid"):
                    text, route = via_europepmc(r["pmid"])
                if text is None and not route:
                    route = "none"; note = "no arXiv ID or PMID: retrieve by hand from an open-access copy"
            except Exception as e:  # network failure is a failed retrieval, not an empty paper
                route, note = route or "error", f"{type(e).__name__}: {e}"[:160]
            if text is None:
                w.writerow([rid, "no", route, "", 0, note]); continue
            if not title_matches(r.get("title", ""), text):
                w.writerow([rid, "no", route, "no", len(text), "fetched text does not carry the record's title; not saved"]); continue
            with open(path, "w", encoding="utf-8") as tf:
                tf.write(text)
            w.writerow([rid, "yes", route, "yes", len(text), note]); got += 1
    print(f"retrieved {got} of {len(a.ids)}; log: {a.log}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
