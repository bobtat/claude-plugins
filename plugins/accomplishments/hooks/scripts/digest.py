#!/usr/bin/env python3
"""Extract a redacted prompt digest from a Claude Code session transcript.

Reads a transcript (JSONL) on stdin, writes a small markdown digest on stdout.

What it keeps: text the user actually typed, redacted and truncated.
What it drops: assistant replies, thinking, tool inputs, tool results, file
contents, and everything the harness injected while wearing the user role.

That last category is larger and better disguised than it looks, and getting it
wrong is this file's worst failure mode. An adversarial review of v0.2.0 found
two escapes, both of which put file contents and source code into digests that
promised to hold neither:

  - Compact summaries. When a session compacts, the harness writes a `user`
    record with `isCompactSummary` and a ~20 KB *model-written recap of the
    entire prior conversation* -- file paths, quoted code, command output. It
    is not sidechain, not meta, and does not start with "<".
  - Slash-command expansions and system-originated prompts. These begin with
    ordinary prose, so a startswith("<") test never sees them. In one real
    corpus, 91 of 120 digests contained a `/security-review` expansion
    carrying an inline unified diff.

So injected content is now identified by record structure first and content
shape second, and the two are independent. Anything the harness marks is
dropped whether or not its text looks injected, and diff-shaped text is dropped
whether or not the record is marked.

Exit codes: 0 wrote a digest, 1 nothing worth writing, 2 refused (bad input).
"""

import json
import os
import re
import sys

MAX_PROMPT_CHARS = 2000
MAX_PROMPTS = 60
MAX_INPUT_BYTES = 64 * 1024 * 1024

# Ordered: the most specific patterns run first so a generic rule cannot
# swallow a token before its own rule sees it.
REDACTIONS = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
     "[PRIVATE-KEY]"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "[PRIVATE-KEY]"),
    (re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"), "[AWS-KEY]"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"), "[GITHUB-TOKEN]"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"), "[GITHUB-PAT]"),
    (re.compile(r"\bglpat-[A-Za-z0-9_-]{16,}"), "[GITLAB-TOKEN]"),
    (re.compile(r"\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}"), "[STRIPE-KEY]"),
    (re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}"), "[API-KEY]"),
    (re.compile(r"\bnpm_[A-Za-z0-9]{30,}"), "[NPM-TOKEN]"),
    (re.compile(r"\bhf_[A-Za-z0-9]{30,}"), "[HF-TOKEN]"),
    (re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}"), "[SLACK-TOKEN]"),
    (re.compile(r"\bAIza[A-Za-z0-9_-]{30,}"), "[GOOGLE-API-KEY]"),
    (re.compile(r"\bAC[0-9a-fA-F]{32}\b"), "[TWILIO-SID]"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*"), "[JWT]"),
    (re.compile(r"(?i)\bAccountKey\s*=\s*[A-Za-z0-9+/=]{20,}"), "AccountKey=[REDACTED]"),
    # Any scheme with credentials in the authority, not just the five databases
    # the previous version listed. Basic-auth URLs were the widest gap.
    (re.compile(r"(?i)\b[a-z][a-z0-9+.-]*://[^\s\"'<>/]+:[^\s\"'<>@]+@[^\s\"'<>]+"),
     "[CREDENTIALED-URL]"),
    (re.compile(r"(?i)(authorization\s*:\s*(?:bearer|basic|token)\s+)\S{8,}"), r"\1[REDACTED]"),
    # Bare KEY= and PASS= were both missing and are the two commonest .env
    # shapes after SECRET=.
    (re.compile(r"(?i)\b([A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|PASSWD|PASS|PWD|CREDENTIAL|AUTH)[A-Z0-9_]*)"
                r"\s*[:=]\s*[\"']?([^\s\"',;]{4,})"),
     r"\1=[REDACTED]"),
    (re.compile(r"(?i)\b(password|passwd|pwd|secret|passphrase)\s+is\s+[\"']?([^\s\"',;.]{4,})"),
     r"\1 is [REDACTED]"),
    # Long unbroken hex or base64 runs: entropy blobs that are rarely prose and
    # frequently keys. Last, so named patterns label them better.
    (re.compile(r"\b[A-Fa-f0-9]{32,}\b"), "[HEX-BLOB]"),
    (re.compile(r"\b[A-Za-z0-9+/]{60,}={0,2}\b"), "[BASE64-BLOB]"),
]

# Fields the harness sets on records it generated itself. Any one of them means
# the text was not typed by a person.
INJECTED_FLAGS = ("isSidechain", "isMeta", "isCompactSummary", "isVisibleInTranscriptOnly")

# Tags the harness wraps injected context in. Matched ANYWHERE, not just at the
# start -- a leading-character test misses every expansion that opens in prose.
INJECTED_TAGS = re.compile(
    r"</?(?:system-reminder|command-name|command-message|command-args|"
    r"local-command-stdout|local-command-stderr|task-notification|"
    r"user-prompt-submit-hook|file-attachment|attachment)\b",
    re.IGNORECASE,
)

# Diff and patch shapes. A pasted diff is source code regardless of how it got
# into the record, and it has no career-journal value at any size.
DIFF_SHAPE = re.compile(
    r"(?m)^(?:diff --git |@@ -\d|\+\+\+ [ab/]|--- [ab/]|index [0-9a-f]{7,}\.\.)",
)


def redact(text):
    for pattern, replacement in REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


def is_injected_record(record):
    """True when the harness, not the user, produced this record."""
    for flag in INJECTED_FLAGS:
        if record.get(flag):
            return True
    # System-originated prompts: task notifications, hook injections, replays.
    if record.get("promptSource") == "system":
        return True
    # `origin` marks WHO produced the turn, and `kind: "human"` is the positive
    # signal for a typed prompt -- not evidence of injection. Only the other
    # kinds (task-notification, auto-continuation) are harness-generated.
    # Treating the field's mere presence as injection drops nearly every real
    # prompt, which is how this rule was first written and wrong.
    origin = record.get("origin")
    if isinstance(origin, dict) and origin.get("kind") not in (None, "human"):
        return True
    return False


def is_injected_text(text):
    """True when the text itself is injected context or pasted code."""
    if text.startswith("<"):
        return True
    if INJECTED_TAGS.search(text):
        return True
    if DIFF_SHAPE.search(text):
        return True
    return False


def user_texts(record):
    """Yield text blocks the user actually typed.

    A record of type "user" also carries tool_result blocks -- command output
    and file contents wearing the user role, and the single largest source of
    secrets in a transcript. Only explicit text blocks are taken.
    """
    if record.get("type") != "user" or is_injected_record(record):
        return
    message = record.get("message")
    if not isinstance(message, dict):
        return
    content = message.get("content")
    if isinstance(content, str):
        yield content
        return
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                yield block.get("text") or ""


def main():
    raw = sys.stdin.buffer.read(MAX_INPUT_BYTES)
    if not raw:
        return 2

    started = ""
    cwd = ""
    branch = ""
    prompts = []
    truncated = 0
    dropped = 0

    for line in raw.decode("utf-8", "replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
        except Exception:
            continue
        if not isinstance(record, dict):
            continue

        if not started and isinstance(record.get("timestamp"), str):
            started = record["timestamp"]
            cwd = record.get("cwd") or ""
            branch = record.get("gitBranch") or ""

        if len(prompts) >= MAX_PROMPTS:
            continue

        for text in user_texts(record):
            text = (text or "").strip()
            if not text:
                continue
            if is_injected_text(text):
                dropped += 1
                continue
            text = redact(text)
            if len(text) > MAX_PROMPT_CHARS:
                text = text[:MAX_PROMPT_CHARS] + " ...[truncated]"
                truncated += 1
            prompts.append((record.get("timestamp", "")[:16], " ".join(text.split())))
            if len(prompts) >= MAX_PROMPTS:
                break

    if not prompts:
        return 1

    # The project and branch names are the two places a client name most
    # reliably appears, and they were previously written raw. They go through
    # the same redaction as prompt text, and the model pass is allowed to
    # rewrite them too.
    project = redact(os.path.basename(cwd)) if cwd else ""
    branch = redact(branch)

    out = sys.stdout
    out.write("---\n")
    out.write(f"session: {os.environ.get('A_SID', '')}\n")
    out.write(f"started: {started}\n")
    out.write(f"project: {project}\n")
    out.write(f"branch: {branch}\n")
    out.write(f"prompts: {len(prompts)}\n")
    out.write(f"truncated: {truncated}\n")
    out.write(f"dropped_injected: {dropped}\n")
    out.write("redaction: regex\n")
    out.write("source: session transcript, typed user prompts only\n")
    out.write("---\n\n")
    out.write("<!-- Assistant replies, tool calls, tool output, file contents,\n")
    out.write("     compact summaries, and injected context are deliberately\n")
    out.write("     absent. See digest.py. -->\n\n")
    for timestamp, text in prompts:
        out.write(f"[{timestamp}] {text}\n\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        # Fail closed: a crash writes nothing rather than writing raw text.
        sys.exit(2)
