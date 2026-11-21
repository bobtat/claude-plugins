#!/bin/sh
# Copies the plugin and changes only its Playwright launch flags, so a fixture run can start a browser
# where a normal install can't: no display, running as root, a browser that isn't on the default path.
# usage: make-plugin.sh <plugin source dir> <copy dir> <playwright output dir>
#   PW_FLAGS   flags to append (default: --headless --isolated)
#   CHROMIUM   path to a Chromium binary, if Playwright's own isn't installed
set -e
SRC="$1"; DST="$2"; OUT="$3"
rm -rf "$DST"; mkdir -p "$DST" "$OUT"; cp -r "$SRC"/. "$DST"/
PW_FLAGS="${PW_FLAGS:---headless --isolated}" node -e '
const fs = require("fs");
const file = process.argv[1] + "/.mcp.json";
const config = JSON.parse(fs.readFileSync(file, "utf8"));
const args = config.mcpServers.playwright.args;
// Outside ~/.claude: a headless session that isn’t in bypass mode refuses `cp` from the plugin data directory.
args[args.indexOf("--output-dir") + 1] = process.argv[2];
args.push(...process.env.PW_FLAGS.split(/\s+/).filter(Boolean));
if (process.env.CHROMIUM) args.push("--executable-path", process.env.CHROMIUM);
fs.writeFileSync(file, JSON.stringify(config, null, 2));' "$DST" "$OUT"
