#!/usr/bin/env bash
set -euo pipefail

# Simple bridge to trigger roo-driver via VS Code's URI handler.
# Usage:
#   rl-bridge.sh start "task text" [--new-tab] [--state-file /tmp/roo-start.json]
#   rl-bridge.sh send  "message"   [--task-id <id>] [--state-file /tmp/roo-send.json]

CODE_BIN=${CODE_BIN:-code}

urlencode() {
	python3 - "$1" <<'PY'
import sys, urllib.parse
print(urllib.parse.quote(sys.argv[1]))
PY
}

die() { echo "[rl-bridge] $*" >&2; exit 1; }

cmd=${1:-}
shift || true

case "$cmd" in
	start)
		text=${1:-}
		shift || true
		new_tab=0
		state_file=""
		while [[ $# -gt 0 ]]; do
			case "$1" in
				--new-tab) new_tab=1; shift ;;
				--state-file) state_file=${2:-}; shift 2 ;;
				*) die "Unknown arg: $1" ;;
			esac
		done
		[[ -n "$text" ]] || die "Missing task text"
		enc_text=$(urlencode "$text")
		uri="vscode://rl.roo-driver/start?task=${enc_text}&newTab=${new_tab}"
		if [[ -n "$state_file" ]]; then
			uri+="&stateFile=$(urlencode "$state_file")"
		fi
		exec "$CODE_BIN" --open-url "$uri"
		;;
	send)
		text=${1:-}
		shift || true
		task_id=""
		state_file=""
		while [[ $# -gt 0 ]]; do
			case "$1" in
				--task-id) task_id=${2:-}; shift 2 ;;
				--state-file) state_file=${2:-}; shift 2 ;;
				*) die "Unknown arg: $1" ;;
			esac
		done
		[[ -n "$text" ]] || die "Missing message text"
		enc_text=$(urlencode "$text")
		uri="vscode://rl.roo-driver/send?text=${enc_text}"
		if [[ -n "$task_id" ]]; then
			uri+="&taskId=$(urlencode "$task_id")"
		fi
		if [[ -n "$state_file" ]]; then
			uri+="&stateFile=$(urlencode "$state_file")"
		fi
		exec "$CODE_BIN" --open-url "$uri"
		;;
	*)
		die "Usage: $0 {start|send} ..."
		;;
esac

