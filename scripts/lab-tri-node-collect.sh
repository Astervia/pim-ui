#!/usr/bin/env bash
# lab-tri-node-collect.sh — Phase 6 Plan 06-04.
#
# Run this on EACH node (the BT-gateway desktop, the relay+client
# laptop, the client PC). Connects to the local pim-daemon Unix socket,
# fires rpc.hello + a handful of read-only RPCs, and emits a single
# JSON document that lab-tri-node-report.sh consumes.
#
# The script does NO destructive work: nothing is configured, no peers
# are paired, no routes are flipped. It is a snapshot, full stop.
#
# Usage:
#   ./scripts/lab-tri-node-collect.sh                         # auto-detect socket
#   ./scripts/lab-tri-node-collect.sh /tmp/pim.sock           # explicit path
#   PIM_RPC_SOCKET=/tmp/pim.sock ./scripts/lab-tri-node-collect.sh
#   ./scripts/lab-tri-node-collect.sh --output /tmp/node-a.json
#
# Output: JSON document on stdout (or written to --output) with shape:
#   {
#     host: "ruy-desktop",
#     timestamp: "2026-04-29T18:30:00Z",
#     hello:        { ok|err, value }
#     status:       { ok|err, value }
#     peers:        { ok|err, value }
#     discovered:   { ok|err, value }
#     routes:       { ok|err, value }
#   }
#
# Each field is wrapped in `{ok, value}` so a failed call doesn't poison
# the whole report — the report script renders FAIL rows for those.
#
# Dependencies: jq (required), and one of socat / nc -U (required).

set -euo pipefail

CLIENT_ID="lab-tri-node-collect/0.1"
TIMEOUT_S=5

# ─── Argument parsing ──────────────────────────────────────────────────
SOCKET=""
OUTPUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)
      OUTPUT="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      if [[ -z "$SOCKET" ]]; then
        SOCKET="$1"
        shift
      else
        echo "lab-tri-node-collect: unexpected argument '$1'" >&2
        exit 64
      fi
      ;;
  esac
done

# ─── Socket resolution ─────────────────────────────────────────────────
if [[ -z "$SOCKET" ]]; then
  SOCKET="${PIM_RPC_SOCKET:-}"
fi
if [[ -z "$SOCKET" ]]; then
  case "$(uname -s)" in
    Darwin)
      SOCKET="${TMPDIR:-/tmp}pim.sock"
      # macOS appends a slash to TMPDIR; strip duplicates.
      SOCKET="${SOCKET//\/\//\/}"
      ;;
    Linux)
      if [[ -n "${XDG_RUNTIME_DIR:-}" ]]; then
        SOCKET="$XDG_RUNTIME_DIR/pim.sock"
      else
        SOCKET="/run/pim/pim.sock"
      fi
      ;;
    *)
      SOCKET="/tmp/pim.sock"
      ;;
  esac
fi

if [[ ! -S "$SOCKET" ]]; then
  echo "lab-tri-node-collect: socket not found at $SOCKET" >&2
  echo "  Set PIM_RPC_SOCKET or pass the path as the first argument." >&2
  exit 65
fi

# ─── Tool detection ────────────────────────────────────────────────────
command -v jq >/dev/null 2>&1 || {
  echo "lab-tri-node-collect: jq is required" >&2
  exit 66
}

WIRE_TOOL=""
if command -v socat >/dev/null 2>&1; then
  WIRE_TOOL="socat"
elif command -v nc >/dev/null 2>&1; then
  WIRE_TOOL="nc"
else
  echo "lab-tri-node-collect: need socat OR nc -U; install one" >&2
  exit 67
fi

REQ_ID=1

# Send a JSON-RPC request, return the first line of the response. Caller
# is responsible for parsing. Errors during transport produce an empty
# string; the JSON-RPC error envelope is left intact for the caller to
# detect via .error.code.
send_request() {
  local method="$1"
  local params="$2"
  local req
  req=$(
    jq -nc \
      --arg m "$method" \
      --argjson p "$params" \
      --argjson id "$REQ_ID" \
      '{jsonrpc:"2.0", id:$id, method:$m, params:$p}'
  )
  REQ_ID=$((REQ_ID + 1))
  case "$WIRE_TOOL" in
    socat)
      printf '%s\n' "$req" \
        | socat -t "$TIMEOUT_S" - "UNIX-CONNECT:$SOCKET" \
        | head -1 \
        || true
      ;;
    nc)
      # macOS / OpenBSD nc supports -U for unix sockets and -w for
      # send-then-read-then-close timeout. GNU netcat (some Linux
      # distros) needs -q 1 instead of -w; we try -w first and let the
      # caller see an empty response on failure.
      printf '%s\n' "$req" \
        | nc -U -w "$TIMEOUT_S" "$SOCKET" \
        | head -1 \
        || true
      ;;
  esac
}

# Wraps `send_request` in a `{ok: bool, value: ...}` envelope so a
# single failed call doesn't crash the whole script.
call_safe() {
  local method="$1"
  local params="$2"
  local raw
  raw=$(send_request "$method" "$params" || true)
  if [[ -z "$raw" ]]; then
    jq -nc --arg m "$method" '{ok:false, value:null, error:("transport: empty response from " + $m)}'
    return
  fi
  if ! echo "$raw" | jq -e . >/dev/null 2>&1; then
    jq -nc --arg m "$method" --arg raw "$raw" '{ok:false, value:null, error:("invalid JSON for " + $m), raw:$raw}'
    return
  fi
  if echo "$raw" | jq -e '.error' >/dev/null 2>&1; then
    local err
    err=$(echo "$raw" | jq -c '.error')
    jq -nc --argjson e "$err" --arg m "$method" '{ok:false, value:null, error:$e}'
    return
  fi
  echo "$raw" | jq -c '{ok:true, value:.result}'
}

# ─── Drive the calls ───────────────────────────────────────────────────
HELLO=$(call_safe "rpc.hello" "{\"client\":\"$CLIENT_ID\",\"rpc_version\":1}")
STATUS=$(call_safe "status" "null")
PEERS=$(call_safe "peers.list" "null")
DISCOVERED=$(call_safe "peers.discovered" "null")
ROUTES=$(call_safe "route.table" "null")

HOSTNAME_VAL=$(hostname)
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

REPORT=$(
  jq -nc \
    --arg host "$HOSTNAME_VAL" \
    --arg ts "$TS" \
    --arg socket "$SOCKET" \
    --argjson hello "$HELLO" \
    --argjson status "$STATUS" \
    --argjson peers "$PEERS" \
    --argjson discovered "$DISCOVERED" \
    --argjson routes "$ROUTES" \
    '{
      host: $host,
      timestamp: $ts,
      socket: $socket,
      hello: $hello,
      status: $status,
      peers: $peers,
      discovered: $discovered,
      routes: $routes
    }'
)

if [[ -n "$OUTPUT" ]]; then
  echo "$REPORT" >"$OUTPUT"
  echo "lab-tri-node-collect: wrote $OUTPUT" >&2
else
  echo "$REPORT"
fi
