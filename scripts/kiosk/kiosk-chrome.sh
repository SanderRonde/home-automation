#!/bin/bash
# Kiosk Chrome Wrapper Script
# Kills and restarts Chrome every 4 hours

set -e

# Source environment variables if available
if [[ -f ~/kiosk/environment ]]; then
    source ~/kiosk/environment
fi

# Configuration
KIOSK_URL="${KIOSK_URL:-http://localhost:3000/dashboard#home-kiosk}"
DISPLAY_NUM="${DISPLAY:-:0}"
RESTART_INTERVAL="${RESTART_INTERVAL:-14400}"  # 4 hours in seconds
CHROME_BIN="${CHROME_BIN:-}"

# Find Chrome/Chromium binary
find_chrome() {
    local bins=(
        "$CHROME_BIN"
        "/usr/bin/chromium"
        "/usr/bin/chromium-browser"
        "/usr/bin/google-chrome-stable"
        "/usr/bin/google-chrome"
        "/opt/google/chrome/chrome"
    )
    
    for bin in "${bins[@]}"; do
        if [[ -n "$bin" && -x "$bin" ]]; then
            echo "$bin"
            return 0
        fi
    done
    
    echo "ERROR: No Chrome/Chromium binary found!" >&2
    return 1
}

CHROME=$(find_chrome)
if [[ -z "$CHROME" ]] || [[ ! -x "$CHROME" ]]; then
    echo "ERROR: Chrome/Chromium binary not found!" >&2
    exit 1
fi

# Chrome flags for kiosk mode
CHROME_FLAGS=(
    --kiosk
    --noerrdialogs
    --disable-infobars
    --disable-session-crashed-bubble
    --disable-restore-session-state
    --disable-features=TranslateUI
    --disable-breakpad
    --disable-component-update
    --check-for-update-interval=31536000
    --no-first-run
    --autoplay-policy=no-user-gesture-required
    --start-fullscreen
    --disable-pinch
    --overscroll-history-navigation=0
    # Disable GPU acceleration to avoid GPU/driver-related renderer issues
    --disable-gpu
    --disable-background-networking
    --disable-default-apps
    --disable-extensions
    --disable-sync
    --disable-translate
    --metrics-recording-only
    --mute-audio
    --no-default-browser-check
    --safebrowsing-disable-auto-update
)

# Clean up any existing Chrome profile locks on startup
PROFILE_DIR="${HOME}/.config/chromium-kiosk"
mkdir -p "$PROFILE_DIR"
rm -f "$PROFILE_DIR/SingletonLock" "$PROFILE_DIR/SingletonCookie" "$PROFILE_DIR/SingletonSocket" 2>/dev/null

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a ~/.kiosk.log >&2
}

cleanup() {
    log "Received termination signal, cleaning up..."
    kill ${CHROME_PID:-} 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT SIGHUP

log "Starting kiosk Chrome wrapper"
log "Chrome binary: $CHROME"
log "Kiosk URL: $KIOSK_URL"
log "Display: $DISPLAY_NUM"
log "Restart interval: $RESTART_INTERVAL seconds (4 hours)"

# Main restart loop
while true; do
    log "Launching Chrome in kiosk mode..."
    
    export DISPLAY="$DISPLAY_NUM"
    
    "$CHROME" \
        --user-data-dir="$PROFILE_DIR" \
        "${CHROME_FLAGS[@]}" \
        "$KIOSK_URL" &
    
    CHROME_PID=$!
    log "Chrome started with PID: $CHROME_PID"
    
    # Wait for the restart interval
    sleep "$RESTART_INTERVAL"
    
    log "Killing Chrome (PID: $CHROME_PID) for scheduled restart..."
    kill "$CHROME_PID" 2>/dev/null || true
    wait "$CHROME_PID" 2>/dev/null || true
    
    # Clean up locks before restarting
    rm -f "$PROFILE_DIR/SingletonLock" "$PROFILE_DIR/SingletonCookie" "$PROFILE_DIR/SingletonSocket" 2>/dev/null
    
    log "Restarting Chrome..."
done

log "Kiosk wrapper exiting"
