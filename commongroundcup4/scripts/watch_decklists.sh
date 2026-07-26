#!/bin/zsh

set -u

readonly EVENT_NAME="The 4th Common Ground Cup"
readonly PLAYERS_URL="https://topdeck.gg/PublicPData/the-4th-common-ground-cup-presented-by-the-common-ground"
readonly INTERVAL_SECONDS="${DECKLIST_WATCH_INTERVAL_SECONDS:-1800}"
readonly SCRIPT_DIR="${0:A:h}"
readonly WATCH_DIR="${SCRIPT_DIR:h}"
readonly LOG_PATH="${WATCH_DIR}/decklist-watch.log"
readonly PID_PATH="${WATCH_DIR}/decklist-watch.pid"

log_message() {
  print -r -- "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $1" >> "$LOG_PATH"
}

notify_found() {
  local count="$1"
  /usr/bin/osascript -e "display notification \"${count} decklists are now public on TopDeck.\" with title \"Common Ground Cup lists are live\"" >/dev/null 2>&1 || true
}

cleanup() {
  if [[ -f "$PID_PATH" ]] && [[ "$(<"$PID_PATH")" == "$$" ]]; then
    /bin/rm -f -- "$PID_PATH"
  fi
}

trap cleanup EXIT
trap 'cleanup; exit 0' INT TERM
print -r -- "$$" > "$PID_PATH"
log_message "Started 30-minute decklist watcher for ${EVENT_NAME}."

while true; do
  payload="$(/usr/bin/curl -fsSL "$PLAYERS_URL" 2>/dev/null)" || {
    log_message "TopDeck check failed; retrying in 30 minutes."
    sleep "$INTERVAL_SECONDS"
    continue
  }

  count="$(print -r -- "$payload" | /usr/bin/jq '[
    .[] |
    select(
      ((.decklist? // "") | if type == "string" then length > 0 else false end)
      or
      ((.deckObj? // {}) | if type == "object" then length > 0 else false end)
    )
  ] | length' 2>/dev/null)" || {
    log_message "TopDeck returned an unreadable response; retrying in 30 minutes."
    sleep "$INTERVAL_SECONDS"
    continue
  }

  if (( count > 0 )); then
    log_message "FOUND: ${count} public decklists. Watcher complete."
    notify_found "$count"
    exit 0
  fi

  log_message "No public decklists yet."
  sleep "$INTERVAL_SECONDS"
done
