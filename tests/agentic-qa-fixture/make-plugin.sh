#!/bin/sh
# Copies the plugin and changes only its Playwright launch flags, so a fixture run can start a browser
# where a normal install can't: no display, running as root, a browser that isn't on the default path.
# Everything else, the output directory included, is as the plugin ships it, unless AGENT_MODELS is set:
# that tries agents on other models without editing the plugin.
# usage: make-plugin.sh <plugin source dir> <copy dir>
#   PW_FLAGS   flags to append (default: --headless --isolated)
#   CHROMIUM   path to a Chromium binary, if Playwright's own isn't installed
#   AGENT_MODELS   agents to run on another model, as "qa-reporter=haiku step-executor=sonnet"
set -e
SRC="$1"; DST="$2"
rm -rf "$DST"; mkdir -p "$DST"; cp -r "$SRC"/. "$DST"/
PW_FLAGS="${PW_FLAGS:---headless --isolated}" node -e '
const fs = require("fs");
const file = process.argv[1] + "/.mcp.json";
const config = JSON.parse(fs.readFileSync(file, "utf8"));
const args = config.mcpServers.playwright.args;
args.push(...process.env.PW_FLAGS.split(/\s+/).filter(Boolean));
if (process.env.CHROMIUM) args.push("--executable-path", process.env.CHROMIUM);
fs.writeFileSync(file, JSON.stringify(config, null, 2));
for (const pair of (process.env.AGENT_MODELS || "").split(/\s+/).filter(Boolean)) {
  const [agent, model] = pair.split("=");
  const md = process.argv[1] + "/agents/" + agent + ".md";
  const text = fs.readFileSync(md, "utf8");
  if (!model || !/^model: .*$/m.test(text)) throw new Error("AGENT_MODELS: cannot set " + pair);
  fs.writeFileSync(md, text.replace(/^model: .*$/m, "model: " + model));
}' "$DST"
