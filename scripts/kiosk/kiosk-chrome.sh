#!/bin/bash
# Kiosk Chrome Wrapper Script
# Monitors for page crashes (renderer crashes) and reloads automatically
# Also restarts Chrome if Chrome itself crashes

# Use set -e for error handling, but allow unset variables with defaults
set -e

# Source environment variables if available
if [[ -f ~/kiosk/environment ]]; then
    source ~/kiosk/environment
fi

# Configuration
KIOSK_URL="${KIOSK_URL:-http://localhost:3000/dashboard#home-kiosk}"
DISPLAY_NUM="${DISPLAY:-:0}"
RESTART_DELAY="${RESTART_DELAY:-3}"
CHROME_BIN="${CHROME_BIN:-}"
DEBUG_PORT="${DEBUG_PORT:-9222}"
CRASH_CHECK_INTERVAL="${CRASH_CHECK_INTERVAL:-5}"

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
    echo "Please install chromium: sudo pacman -S chromium" >&2
    # Instead of exiting, try to keep X running with a terminal for debugging
    if command -v xterm &>/dev/null; then
        exec xterm -e "echo 'Chrome not found. Install with: sudo pacman -S chromium'; bash"
    else
        # Last resort: sleep forever to keep X running
        echo "Keeping X session alive for debugging..." >&2
        while true; do sleep 60; done
    fi
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
    # Enable remote debugging for crash detection
    --remote-debugging-port=$DEBUG_PORT
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
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a ~/.kiosk.log >&2
}

cleanup() {
    log "Received termination signal, cleaning up..."
    kill ${MONITOR_PID:-} 2>/dev/null || true
    kill ${CHROME_PID:-} 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT SIGHUP

# Function to get the WebSocket URL for the page
get_page_ws_url() {
    curl -s "http://localhost:$DEBUG_PORT/json" 2>/dev/null | \
        grep -o '"webSocketDebuggerUrl":"[^"]*"' | \
        head -1 | \
        sed 's/"webSocketDebuggerUrl":"//;s/"$//'
}

# Function to check if page has crashed and reload if needed
# Uses Chrome DevTools Protocol via the /json endpoint
check_and_reload_crashed_page() {
    local chrome_pid=$1
    while true; do
        sleep "$CRASH_CHECK_INTERVAL"
        
        # Check if Chrome is still running
        if [[ -z "$chrome_pid" ]] || ! kill -0 "$chrome_pid" 2>/dev/null; then
            log "Chrome process died, monitor exiting"
            break
        fi
        
        # Get page info from CDP
        PAGE_INFO=$(curl -s "http://localhost:$DEBUG_PORT/json" 2>/dev/null)
        
        if [[ -z "$PAGE_INFO" ]]; then
            log "Cannot connect to Chrome DevTools, Chrome may be starting..."
            continue
        fi
        
        # Check for crashed page indicators
        # When a page crashes, the title often contains "Aw, Snap!" or the URL becomes chrome-error://
        if echo "$PAGE_INFO" | grep -q '"title":\s*"Aw, Snap!"' || \
           echo "$PAGE_INFO" | grep -q 'chrome-error://' || \
           echo "$PAGE_INFO" | grep -q '"title":\s*""'; then
            log "PAGE CRASH DETECTED! Reloading page..."
            
            # Get the WebSocket URL and target ID
            TARGET_ID=$(echo "$PAGE_INFO" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"$//')
            
            if [[ -n "$TARGET_ID" ]]; then
                # Use CDP to navigate to the URL (effectively a reload)
                curl -s "http://localhost:$DEBUG_PORT/json/navigate/$TARGET_ID?url=$(echo "$KIOSK_URL" | sed 's/#/%23/g')" >/dev/null 2>&1
                log "Reload command sent via CDP"
            else
                # Fallback: use xdotool to send F5
                if command -v xdotool &>/dev/null; then
                    DISPLAY="$DISPLAY_NUM" xdotool key F5
                    log "Reload command sent via xdotool"
                fi
            fi
            
            sleep 3  # Wait for page to reload before checking again
        fi
    done
}

log "Starting kiosk Chrome wrapper"
log "Chrome binary: $CHROME"
log "Kiosk URL: $KIOSK_URL"
log "Display: $DISPLAY_NUM"
log "Profile directory: $PROFILE_DIR"
log "Debug port: $DEBUG_PORT"

# Main restart loop (handles Chrome process crashes)
while true; do
    log "Launching Chrome in kiosk mode..."
    
    # Set display
    export DISPLAY="$DISPLAY_NUM"
    
    # Run Chrome
    "$CHROME" \
        --user-data-dir="$PROFILE_DIR" \
        "${CHROME_FLAGS[@]}" \
        "$KIOSK_URL" &
    
    CHROME_PID=$!
    log "Chrome started with PID: $CHROME_PID"
    
    # Wait for Chrome to be ready
    sleep 3
    
    # Start the page crash monitor in background
    check_and_reload_crashed_page $CHROME_PID &
    MONITOR_PID=$!
    log "Page crash monitor started with PID: $MONITOR_PID"
    
    # Wait for Chrome to exit
    wait $CHROME_PID || true
    EXIT_CODE=$?
    
    # Stop the monitor
    kill ${MONITOR_PID:-} 2>/dev/null || true
    
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
