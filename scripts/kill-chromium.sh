#!/bin/bash
# Kill Chromium Daily Script
# Kills all chromium processes to prevent memory leaks and performance issues
# Runs as root

set -e

LOG_FILE="/var/log/kill-chromium.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting daily chromium cleanup..."

# Check if chromium is running
if pgrep -x chromium > /dev/null; then
    log "Chromium processes found, killing..."
    killall chromium || true
    log "Chromium processes killed successfully"
else
    log "No chromium processes found"
fi

log "Daily chromium cleanup completed"
