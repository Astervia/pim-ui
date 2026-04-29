#!/usr/bin/env bash
# lab-tri-node-report.sh — Phase 6 Plan 06-04.
#
# Combine three (or two, or N) per-host JSON snapshots produced by
# `lab-tri-node-collect.sh` into a single human-readable markdown
# report — useful as an artifact attached to UAT runs.
#
# Output sections:
#   1. Header — timestamps + host names
#   2. Role + identity table — node | role | mesh_ip | uptime | RPC version
#   3. Peer matrix — for each (host A, host B), is B in A's peers.list
#      with state==active / connecting / failed / absent?
#   4. Route table summary — gateways known, routes per host with hops
#   5. Discovery freshness — peers.discovered last_seen per host
#   6. Failures — any per-call failures from the collect step
#
# Usage:
#   ./scripts/lab-tri-node-report.sh node-a.json node-b.json node-c.json
#   ./scripts/lab-tri-node-report.sh --output run.md *.json
#
# Dependencies: jq (required).

set -euo pipefail

OUTPUT=""
INPUTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)
      OUTPUT="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      INPUTS+=("$1")
      shift
      ;;
  esac
done

if [[ ${#INPUTS[@]} -lt 2 ]]; then
  echo "lab-tri-node-report: need at least 2 collect JSONs" >&2
  exit 64
fi

command -v jq >/dev/null 2>&1 || {
  echo "lab-tri-node-report: jq is required" >&2
  exit 66
}

# Stream the rendered markdown to stdout (or buffer to a file at the end).
RENDER() {
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  printf '# lab-tri-node report\n\n'
  printf '_Generated %s · %d hosts._\n\n' "$now" "${#INPUTS[@]}"

  # ── §1: identity table ───────────────────────────────────────────────
  printf '## Identity + role\n\n'
  printf '| host | role | mesh_ip | uptime_s | daemon | rpc |\n'
  printf '|---|---|---|---|---|---|\n'
  for f in "${INPUTS[@]}"; do
    jq -r '
      [
        .host,
        ((.status.value.role // []) | join("+")),
        (.status.value.mesh_ip // "—"),
        (.status.value.uptime_s // 0 | tostring),
        (.hello.value.daemon // "—"),
        (.hello.value.rpc_version // "—" | tostring)
      ]
      | "| " + (map(. // "—") | join(" | ")) + " |"
    ' "$f"
  done
  printf '\n'

  # ── §2: peer matrix ──────────────────────────────────────────────────
  printf '## Peer matrix\n\n'
  printf '_For each (row → col) cell: B'\''s state in A'\''s peers.list._\n\n'
  printf '|     |'
  for f in "${INPUTS[@]}"; do
    local h
    h=$(jq -r '.host' "$f")
    printf ' %s |' "$h"
  done
  printf '\n|---|'
  for _ in "${INPUTS[@]}"; do printf '%s' '---|'; done
  printf '\n'

  for ROW in "${INPUTS[@]}"; do
    local row_host
    row_host=$(jq -r '.host' "$ROW")
    printf '| **%s** |' "$row_host"
    for COL in "${INPUTS[@]}"; do
      local col_host col_node_id state
      col_host=$(jq -r '.host' "$COL")
      col_node_id=$(jq -r '.status.value.node_id // ""' "$COL")
      if [[ "$row_host" == "$col_host" ]]; then
        printf ' — |'
        continue
      fi
      if [[ -z "$col_node_id" ]]; then
        printf ' (no id) |'
        continue
      fi
      # Look up the col host's node_id inside the row host's peers list.
      state=$(
        jq -r --arg id "$col_node_id" '
          (.peers.value // [])
          | map(select(.node_id == $id))
          | if length == 0 then "absent" else .[0].state + " (" + .[0].transport + ")" end
        ' "$ROW"
      )
      printf ' %s |' "$state"
    done
    printf '\n'
  done
  printf '\n'

  # ── §3: route table ──────────────────────────────────────────────────
  printf '## Route table summary\n\n'
  for f in "${INPUTS[@]}"; do
    local h
    h=$(jq -r '.host' "$f")
    printf '### %s\n\n' "$h"
    printf '| destination | via | hops | learned_from | gateway? | age_s |\n'
    printf '|---|---|---|---|---|---|\n'
    jq -r '
      (.routes.value.routes // [])
      | map("| " + .destination + " | " + .via + " | " + (.hops | tostring) + " | " + .learned_from + " | " + (if .is_gateway then "yes" else "no" end) + " | " + (.age_s | tostring) + " |")
      | join("\n")
    ' "$f"
    printf '\n\n**Known gateways:**\n\n'
    jq -r '
      (.routes.value.gateways // [])
      | if length == 0 then "_none_"
        else
          (["| node_id | via | hops | score | selected |", "|---|---|---|---|---|"]
           + (map("| " + .node_id + " | " + .via + " | " + (.hops | tostring) + " | " + (.score | tostring) + " | " + (if .selected then "**yes**" else "no" end) + " |")))
          | join("\n")
        end
    ' "$f"
    printf '\n\n'
  done

  # ── §4: discovery ────────────────────────────────────────────────────
  printf '## Discovery freshness\n\n'
  for f in "${INPUTS[@]}"; do
    local h
    h=$(jq -r '.host' "$f")
    printf '### %s\n\n' "$h"
    jq -r '
      (.discovered.value // [])
      | if length == 0 then "_no peers discovered_"
        else
          (["| node_id | mechanism | address | label | last_seen_s |", "|---|---|---|---|---|"]
           + (map("| " + (.node_id // "(anonymous)") + " | " + .mechanism + " | " + .address + " | " + (.label_announced // "—") + " | " + (.last_seen_s | tostring) + " |")))
          | join("\n")
        end
    ' "$f"
    printf '\n\n'
  done

  # ── §5: failures ─────────────────────────────────────────────────────
  printf '## Failures\n\n'
  local any_failure=0
  for f in "${INPUTS[@]}"; do
    local h
    h=$(jq -r '.host' "$f")
    local fail_lines
    fail_lines=$(
      jq -r --arg host "$h" '
        [
          {call:"hello",       wrap:.hello},
          {call:"status",      wrap:.status},
          {call:"peers",       wrap:.peers},
          {call:"discovered",  wrap:.discovered},
          {call:"routes",      wrap:.routes}
        ]
        | map(select((.wrap.ok // false) == false))
        | map("- **" + $host + "** · " + .call + " — " + (.wrap.error | tostring))
        | join("\n")
      ' "$f"
    )
    if [[ -n "$fail_lines" ]]; then
      printf '%s\n' "$fail_lines"
      any_failure=1
    fi
  done
  if [[ $any_failure -eq 0 ]]; then
    printf '_no failures across %d hosts._\n' "${#INPUTS[@]}"
  fi
  printf '\n'
}

if [[ -n "$OUTPUT" ]]; then
  RENDER >"$OUTPUT"
  echo "lab-tri-node-report: wrote $OUTPUT" >&2
else
  RENDER
fi
