# Roo Driver

Headless-friendly VS Code extension to programmatically drive Roo Code using commands and URI handlers. Useful for RL training pipelines with xvfb.

## Features

- Commands:
  - `rooDriver.startTask`: Start a new Roo task
  - `rooDriver.sendMessage`: Send a message to the current (or specified) Roo task
- URI endpoints (for `code --open-url`):
  - `vscode://rl.roo-driver/start?task=...&newTab=1&stateFile=/tmp/roo-start.json`
  - `vscode://rl.roo-driver/send?text=...&taskId=<id>&stateFile=/tmp/roo-send.json`

If `stateFile` is provided, the extension writes a small JSON with `{ ok, taskId }` which you can parse from scripts.

## Install

1) Install Roo Code extension (from Marketplace) inside your VS Code/Code server environment.

2) Build and install Roo Driver:

```bash
cd roo-driver
npm install
npm run compile
# Then either run from source or package and install with vsce if desired
```

## Headless usage with xvfb

Run VS Code under a virtual framebuffer and use `--open-url` to trigger actions:

```bash
xvfb-run -a code --new-window /workspace

# Start a Roo task via URI (the VS Code instance can be already running or will be spawned)
xvfb-run -a code --open-url "vscode://rl.roo-driver/start?task=$(printf %s "在 src/utils.ts 实现 xx 并补测" | jq -sRr @uri)&newTab=1&stateFile=/tmp/roo-start.json"

# Send a follow-up message (optionally provide taskId; otherwise last task is used)
xvfb-run -a code --open-url "vscode://rl.roo-driver/send?text=$(printf %s "继续到单测阶段" | jq -sRr @uri)&stateFile=/tmp/roo-send.json"
```

Tip: If `jq` is not available, use Python for URL encoding:

```bash
python3 - <<'PY'
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1]))
PY "要编码的文本"
```

## Shell bridge

See `../scripts/rl-bridge.sh` for a tiny CLI wrapper usable from RL pipelines.

## Notes

- The extension tries both `RooVeterinaryInc.roo-cline` and `RooVeterinaryInc.roo-code` as the Roo extension id.
- There is a known timing issue when sending immediately after creating a task; a small retry is built in.

