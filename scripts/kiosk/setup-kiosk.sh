#!/bin/bash
# Arch Linux Kiosk Setup Script
# Sets up automatic login, X11 with i3, and Chrome kiosk mode
#
# Run as root: sudo ./setup-kiosk.sh <username> [kiosk-url]

set -e

if [[ $EUID -ne 0 ]]; then
    echo "This script must be run as root (sudo)"
    exit 1
fi

KIOSK_USER="${1:-}"
KIOSK_URL="${2:-http://localhost:3000/dashboard#home-kiosk}"

if [[ -z "$KIOSK_USER" ]]; then
    echo "Usage: $0 <username> [kiosk-url]"
    echo ""
    echo "Arguments:"
    echo "  username    - The user to run the kiosk as"
    echo "  kiosk-url   - URL to display (default: http://localhost:3000/dashboard#home-kiosk)"
    exit 1
fi

# Check if user exists
if ! id "$KIOSK_USER" &>/dev/null; then
    echo "User '$KIOSK_USER' does not exist. Create it first:"
    echo "  useradd -m -G video,audio $KIOSK_USER"
    exit 1
fi

KIOSK_HOME=$(eval echo "~$KIOSK_USER")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Arch Linux Kiosk Setup ==="
echo "User: $KIOSK_USER"
echo "Home: $KIOSK_HOME"
echo "URL: $KIOSK_URL"
echo ""

# Install required packages
echo "[1/6] Installing required packages..."
pacman -S --noconfirm --needed \
    xorg-server \
    xorg-xinit \
    xorg-xset \
    chromium \
    i3-wm \
    unclutter \
    curl \
    || echo "Some packages may already be installed"

# Create kiosk directory
echo "[2/6] Setting up kiosk scripts..."
KIOSK_DIR="$KIOSK_HOME/kiosk"
mkdir -p "$KIOSK_DIR"
cp "$SCRIPT_DIR/kiosk-chrome.sh" "$KIOSK_DIR/"
chmod +x "$KIOSK_DIR/kiosk-chrome.sh"
chown -R "$KIOSK_USER:$KIOSK_USER" "$KIOSK_DIR"

# Create .xinitrc
echo "[3/6] Creating X11 startup configuration..."
cat > "$KIOSK_HOME/.xinitrc" << XINITRC
#!/bin/bash

# Redirect errors to log file for debugging
exec 2>> ~/.xsession-errors

# Disable screen saver and power management
xset s off 2>/dev/null || true
xset s noblank 2>/dev/null || true
xset -dpms 2>/dev/null || true

# Run screen layout script
${KIOSK_HOME}/.screenlayout/screens.sh 2>/dev/null || true

# Hide cursor after 1 second of inactivity (if available)
if command -v unclutter &>/dev/null; then
    unclutter -idle 1 -root &
fi

# Start i3 window manager in background
i3 &

# Wait for i3 to initialize
sleep 2

# Start the kiosk Chrome script (this keeps X running)
if [[ -f ~/kiosk/kiosk-chrome.sh ]]; then
    exec ~/kiosk/kiosk-chrome.sh
else
    echo "ERROR: kiosk-chrome.sh not found at ~/kiosk/kiosk-chrome.sh!" >> ~/.xsession-errors
    # Keep i3 running if Chrome script not found
    wait
fi
XINITRC
chmod +x "$KIOSK_HOME/.xinitrc"
chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.xinitrc"

# Create i3 config for kiosk mode
echo "[3.5/6] Creating i3 kiosk config..."
I3_CONFIG_DIR="$KIOSK_HOME/.config/i3"
mkdir -p "$I3_CONFIG_DIR"
cat > "$I3_CONFIG_DIR/config" << 'I3CONFIG'
# i3 config for kiosk mode

# Font configuration (fixes "missing config font" error)
font pango:monospace 10

# Set Mod key (Super/Windows key)
set $mod Mod4

# Window borders - visible so you can see it's working
default_border pixel 2
default_floating_border pixel 2

# Window border colors
client.focused          #4c7899 #285577 #ffffff #2e9ef4 #285577
client.focused_inactive #333333 #5f676a #ffffff #484e50 #5f676a
client.unfocused       #333333 #222222 #888888 #292d2e #222222
client.urgent          #2f343a #900000 #ffffff #900000 #900000
client.placeholder     #000000 #0c0c0c #ffffff #000000 #0c0c0c
client.background      #ffffff

# Hide i3bar (but keep it configured)
bar {
    mode invisible
    position top
}

# Basic keybindings
# Start a terminal
bindsym $mod+Return exec terminator

# Exit i3 (logout)
bindsym $mod+Shift+e exec "i3-msg exit"

# Restart i3 in place
bindsym $mod+Shift+r restart

# Kill focused window
bindsym $mod+Shift+q kill

# Make all windows fullscreen by default
for_window [class=".*"] fullscreen enable
I3CONFIG
chown -R "$KIOSK_USER:$KIOSK_USER" "$I3_CONFIG_DIR"

# Set environment variables
echo "[4/6] Configuring environment..."
cat > "$KIOSK_DIR/environment" << EOF
KIOSK_URL=$KIOSK_URL
DISPLAY=:0
EOF
chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_DIR/environment"

# Setup auto-login with getty
echo "[5/6] Configuring auto-login..."
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF
systemctl daemon-reload

# Auto-start X on login
echo "[6/6] Configuring auto-start of X11..."
BASH_PROFILE="$KIOSK_HOME/.bash_profile"

# Check if auto-start is already configured
if ! grep -q "startx" "$BASH_PROFILE" 2>/dev/null; then
    cat >> "$BASH_PROFILE" << 'BASHPROFILE'

# Auto-start X11 on tty1
if [[ -z $DISPLAY ]] && [[ $(tty) = /dev/tty1 ]]; then
    # Redirect errors for debugging
    exec startx 2>> ~/.xsession-errors
fi
BASHPROFILE
    chown "$KIOSK_USER:$KIOSK_USER" "$BASH_PROFILE"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "The kiosk will automatically:"
echo "  1. Auto-login as '$KIOSK_USER' on boot"
echo "  2. Start X11 with i3 automatically"
echo "  3. Launch Chrome in kiosk mode"
echo "  4. Reload the page if it crashes (renderer crash)"
echo "  5. Restart Chrome if Chrome itself crashes"
echo ""
echo "To test immediately (without reboot):"
echo "  sudo systemctl restart getty@tty1"
echo ""
echo "To change the kiosk URL, edit:"
echo "  $KIOSK_DIR/environment"
echo ""
echo "Logs can be viewed with:"
echo "  journalctl -f"
echo ""
echo "To disable kiosk mode (if stuck in boot loop):"
echo "  sudo ./disable-kiosk.sh $KIOSK_USER"
echo ""
echo "Or manually:"
echo "  sudo rm /etc/systemd/system/getty@tty1.service.d/autologin.conf"
echo "  sudo systemctl daemon-reload"
echo ""
echo "To debug X11 issues, check:"
echo "  ~/.xsession-errors"
echo "  journalctl -u getty@tty1"
