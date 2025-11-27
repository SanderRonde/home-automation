#!/bin/bash
# Kiosk Chrome Wrapper Script
# Automatically restarts Chrome when it crashes (including SIGILL)

set -u

# Configuration
KIOSK_URL="${KIOSK_URL:-http://localhost:3000/dashboard#home-kiosk}"
DISPLAY_NUM="${DISPLAY:-:0}"
RESTART_DELAY="${RESTART_DELAY:-3}"
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

CHROME=$(find_chrome) || exit 1

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
    # GPU flags - may help with stability
    --enable-gpu-rasterization
    --ignore-gpu-blocklist
    # Disable some features that may cause instability
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
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

cleanup() {
    log "Received termination signal, cleaning up..."
    # Kill any child Chrome processes
    pkill -P $$ 2>/dev/null
    exit 0
}

trap cleanup SIGTERM SIGINT SIGHUP

log "Starting kiosk Chrome wrapper"
log "Chrome binary: $CHROME"
log "Kiosk URL: $KIOSK_URL"
log "Display: $DISPLAY_NUM"
log "Profile directory: $PROFILE_DIR"

# Main restart loop
while true; do
    log "Launching Chrome in kiosk mode..."
    
    # Set display
    export DISPLAY="$DISPLAY_NUM"
    
    # Run Chrome and capture exit code
    "$CHROME" \
        --user-data-dir="$PROFILE_DIR" \
        "${CHROME_FLAGS[@]}" \
        "$KIOSK_URL" &
    
    CHROME_PID=$!
    log "Chrome started with PID: $CHROME_PID"
    
    # Wait for Chrome to exit
    wait $CHROME_PID
    EXIT_CODE=$?
    
    # Decode exit code
    case $EXIT_CODE in
        0)
            log "Chrome exited normally (code 0)"
            ;;
        132)
            log "Chrome crashed with SIGILL (Illegal Instruction) - exit code 132"
            ;;
        134)
            log "Chrome crashed with SIGABRT - exit code 134"
            ;;
        137)
            log "Chrome killed with SIGKILL - exit code 137"
            ;;
        139)
            log "Chrome crashed with SIGSEGV (Segmentation Fault) - exit code 139"
            ;;
        143)
            log "Chrome terminated with SIGTERM - exit code 143"
            break  # Normal termination, don't restart
            ;;
        *)
            log "Chrome exited with code: $EXIT_CODE"
            ;;
    esac
    
    # Clean up locks before restarting
    rm -f "$PROFILE_DIR/SingletonLock" "$PROFILE_DIR/SingletonCookie" "$PROFILE_DIR/SingletonSocket" 2>/dev/null
    
    log "Restarting Chrome in $RESTART_DELAY seconds..."
    sleep "$RESTART_DELAY"
done

log "Kiosk wrapper exiting"
