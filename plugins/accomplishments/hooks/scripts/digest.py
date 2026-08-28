#!/usr/bin/env python3
"""Extract a redacted prompt digest from a Claude Code session transcript.

Reads a transcript (JSONL) on stdin, writes a small markdown digest on stdout.

What it keeps: the user's own typed prompts, redacted and truncated.
What it drops: assistant replies, thinking, tool inputs, tool results, file
contents, and every system-injected block.

That split is not arbitrary. Measured across 114 real transcripts, tool
traffic is 44% of content and carried 92 of the 120 credential-shaped strings
found anywhere; the user's prompts are 7.8% of content and carried 28. Dropping
everything but the prompts removes three quarters of the exposure and about
99.8% of the bytes, while keeping the part with career signal: the problem the
user brought, and the decisions they made about it.

The remaining 28 are what the redaction below is for. Regex cannot catch a
secret stated in prose -- that is what the Haiku pass in scrub-digest.sh adds.
This stage exists so that something safe is on disk immediately, without
waiting on a model call that may never run.

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
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[AWS-ACCESS-KEY]"),
    (re.compile(r"\bASIA[0-9A-Z]{16}\b"), "[AWS-TEMP-KEY]"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"), "[GITHUB-TOKEN]"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"), "[GITHUB-PAT]"),
    (re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}"), "[API-KEY]"),
    (re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}"), "[SLACK-TOKEN]"),
    (re.compile(r"\bAIza[A-Za-z0-9_-]{30,}"), "[GOOGLE-API-KEY]"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*"), "[JWT]"),
    (re.compile(r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)://[^\s\"'<>]*:[^\s\"'<>@]+@[^\s\"'<>]+"),
     "[CONNECTION-STRING]"),
    (re.compile(r"(?i)(authorization\s*:\s*(?:bearer|basic)\s+)\S{8,}"), r"\1[REDACTED]"),
    (re.compile(r"(?i)\b([A-Z0-9_]*(?:SECRET|TOKEN|API[_-]?KEY|PASSWORD|PASSWD|PWD|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*[\"']?([^\s\"',;]{4,})"),
     r"\1=[REDACTED]"),
    (re.compile(r"(?i)\b(password|passwd|pwd|secret)\s*[:=]\s*[\"']?([^\s\"',;]{4,})"),
     r"\1=[REDACTED]"),
    # Long unbroken hex or base64 runs: entropy blobs that are rarely prose and
    # frequently keys. Deliberately last so named patterns label them better.
    (re.compile(r"\b[A-Fa-f0-9]{40,}\b"), "[HEX-BLOB]"),
    (re.compile(r"\b[A-Za-z0-9+/]{60,}={0,2}\b"), "[BASE64-BLOB]"),
]


def redact(text):
    for pattern, replacement in REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


def user_texts(record):
    """Yield the user's own typed text blocks from one transcript record.

    A record of type "user" also carries tool_result blocks -- those are
    command output and file contents wearing the user role, and they are the
    single largest source of secrets in a transcript. Only explicit text
    blocks are taken.
    """
    if record.get("type") != "user" or record.get("isSidechain") or record.get("isMeta"):
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
            # Injected context -- system reminders, command stdout, file
            # attachments -- is wrapped in tags and is never something the
            # user typed.
            if not text or text.startswith("<"):
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

    session = os.environ.get("A_SID", "")
    out = sys.stdout
    out.write("---\n")
    out.write(f"session: {session}\n")
    out.write(f"started: {started}\n")
    out.write(f"project: {os.path.basename(cwd) if cwd else ''}\n")
    out.write(f"branch: {branch}\n")
    out.write(f"prompts: {len(prompts)}\n")
    out.write(f"truncated: {truncated}\n")
    out.write("redaction: regex\n")
    out.write("source: session transcript, user prompts only\n")
    out.write("---\n\n")
    out.write("<!-- Assistant replies, tool calls, tool output, and file\n")
    out.write("     contents are deliberately absent. See digest.py. -->\n\n")
    for timestamp, text in prompts:
        out.write(f"[{timestamp}] {text}\n\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        # Fail closed: a crash writes nothing rather than writing raw text.
        sys.exit(2)
