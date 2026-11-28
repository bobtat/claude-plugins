#!/usr/bin/env python3
"""Fetch each record's open-access full text once and save it as plain text.

    python3 fetch_fulltext.py records.csv ID [ID ...] --out fulltext/ --log retrieval.csv

Screeners, the adjudicator and appraisal readers all read the saved copy, so every
quotation can later be checked against the exact text that was read, and nobody
fetches the same paper three times. Standard library only.

Routes, tested: arXiv HTML rendering (arxiv.org/html/<id>) for records with an
arXiv ID; Europe PMC full-text XML for open-access PubMed records. A record with
neither is logged as not retrieved by this script.

With --oa-copies, a record the first two routes did not reach is looked up at
OpenAlex by DOI or OpenAlex ID, and the open-access copies OpenAlex lists for it
are tried in order. Only a PDF is accepted: a publisher's landing page carries the
abstract and would pass for a full text that says nothing about methods. A landing
page is read only for the PDF link it declares (citation_pdf_url). The PDF is
turned into text by `pdftotext` (poppler), which must be installed for this route.
Nothing is fetched from a location OpenAlex does not mark open access, and a copy
that answers with a login page or a refusal is logged as not retrieved. The log's
note gives the copy's version and address: a submittedVersion is a preprint, and
whoever reads it is reading something other than the paper of record.

A record ID becomes a file name, where a dot separates a record from a later
supplement (<record_id>.<part>.txt). So an ID is letters, digits, hyphens and
underscores only, and the script fetches nothing if one is not.

Each saved text is checked against the record's title. A fetch whose text does not
carry the title is NOT saved: getting the wrong paper is the failure this whole
plugin is built against.
"""
import argparse, csv, html, json, os, re, shutil, subprocess, sys, tempfile, time
import urllib.parse, urllib.request

UA = "literature-review-plugin/0.3 (systematic review tooling)"
MAX_PDF = 60 * 1024 * 1024      # bytes read from one copy
MIN_PDF_TEXT = 3000             # characters; less means a scan with no text layer
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8", errors="replace")


def get_bytes(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read(MAX_PDF + 1), r.geturl()


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


def oa_urls(work):
    """Open-access copies OpenAlex lists for a work, best first: [(version, url)].

    The version is OpenAlex's: publishedVersion, acceptedVersion or submittedVersion
    (a preprint). It is logged, because a preprint is not the paper of record.
    """
    locs = [work.get("best_oa_location") or {}] + list(work.get("locations") or [])
    out = []
    for loc in locs:
        if not loc or not loc.get("is_oa"):
            continue
        for kind in ("pdf_url", "landing_page_url"):
            u = loc.get(kind)
            if u and u.startswith(("http://", "https://")) and u not in [x[1] for x in out]:
                out.append((loc.get("version") or "version not stated", u))
    return out


def pdf_link(page, base):
    """The PDF a landing page declares for itself, or None."""
    for tag in re.findall(r"(?is)<meta\b[^>]*>", page):
        if re.search(r"""(?i)name\s*=\s*["']citation_pdf_url["']""", tag):
            m = re.search(r"""(?i)content\s*=\s*["']([^"']+)["']""", tag)
            if m:
                return urllib.parse.urljoin(base, html.unescape(m.group(1).strip()))
    return None


def pdf_to_text(data):
    """Text of a PDF, or (None, reason)."""
    exe = shutil.which("pdftotext")
    if not exe:
        return None, "pdftotext-not-installed"
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(data)
        name = f.name
    try:
        p = subprocess.run([exe, "-enc", "UTF-8", name, "-"], capture_output=True, timeout=120)
    except subprocess.TimeoutExpired:
        return None, "pdftotext-timeout"
    finally:
        os.unlink(name)
    if p.returncode != 0:
        return None, "pdftotext-failed"
    text = p.stdout.decode("utf-8", errors="replace").replace("\f", "\n\n")
    text = re.sub(r"[ \t\r\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    if len(text) < MIN_PDF_TEXT:
        return None, "pdf-has-no-text-layer"
    return text, ""


def fetch_pdf(url):
    """(pdf bytes, final url) or (None, reason). Follows one declared PDF link."""
    code, data, final = get_bytes(url)
    if data[:5] == b"%PDF-":
        return (data, final) if len(data) <= MAX_PDF else (None, "pdf-too-large")
    link = pdf_link(data[:400000].decode("utf-8", errors="replace"), final)
    if not link:
        return None, "no-pdf-at-copy"
    code, data, final = get_bytes(link)
    if data[:5] == b"%PDF-":
        return (data, final) if len(data) <= MAX_PDF else (None, "pdf-too-large")
    return None, "declared-link-is-not-a-pdf"


def via_oa_copy(rec, title):
    """(text, route, note). Tries each open-access copy OpenAlex lists until one is the paper."""
    if rec.get("doi"):
        key = "https://doi.org/" + re.sub(r"(?i)^(https?://(dx\.)?doi\.org/|doi:)", "", rec["doi"].strip())
    elif rec.get("openalex_id"):
        key = rec["openalex_id"].strip().rsplit("/", 1)[-1]
    else:
        return None, "oa-copy:no-doi-or-openalex-id", ""
    url = "https://api.openalex.org/works/" + urllib.parse.quote(key, safe=":/") + "?select=id,best_oa_location,locations"
    if os.environ.get("OPENALEX_API_KEY"):
        url += "&api_key=" + urllib.parse.quote(os.environ["OPENALEX_API_KEY"])
    try:
        _, body = get(url)
    except Exception as e:
        return None, "oa-copy:openalex-lookup-failed", f"{type(e).__name__}: {e}"[:160]
    copies = oa_urls(json.loads(body))
    if not copies:
        return None, "oa-copy:none-listed", "OpenAlex lists no open-access copy"
    tried = []
    for version, u in copies[:6]:
        host = urllib.parse.urlparse(u).netloc
        try:
            data, where = fetch_pdf(u)
            if data is None:
                tried.append(f"{host}: {where}"); continue
            text, why = pdf_to_text(data)
            if text is None:
                tried.append(f"{host}: {why}"); continue
            if not title_matches(title, text):
                tried.append(f"{host}: pdf does not carry the record's title"); continue
            return text, "oa-copy:" + urllib.parse.urlparse(where).netloc, f"{version}; {where}"
        except Exception as e:
            tried.append(f"{host}: {type(e).__name__}: {e}"[:90])
        time.sleep(1)
    return None, "oa-copy:no-copy-usable", "; ".join(tried)[:400]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("records")
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--log", required=True, help="CSV appended with one row per record")
    ap.add_argument("--pause", type=float, default=3.0, help="seconds between arXiv requests")
    ap.add_argument("--oa-copies", action="store_true",
                    help="also try the open-access copies OpenAlex lists (PDF only; needs pdftotext)")
    a = ap.parse_args()

    bad = [i for i in a.ids if not ID_RE.match(i)]
    if bad:
        print(f"error: record ID {bad[0]!r} cannot name a file in {a.out}; a record ID is "
              "letters, digits, hyphens and underscores only. Nothing fetched.", file=sys.stderr)
        return 2
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
                if text is None and a.oa_copies:
                    first = route
                    text, route, note = via_oa_copy(r, r.get("title", ""))
                    if text is None and first:
                        route = f"{first}; {route}"
                if text is None and not route:
                    route = "none"; note = "no arXiv ID or PMID; --oa-copies not given"
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
