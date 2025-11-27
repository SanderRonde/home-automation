#!/bin/bash
# Arch Linux Kiosk Setup Script
# Sets up automatic login, X11/Wayland, and Chrome kiosk mode
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
    openbox \
    unclutter \
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
cat > "$KIOSK_HOME/.xinitrc" << 'XINITRC'
#!/bin/bash

# Disable screen saver and power management
xset s off
xset s noblank
xset -dpms

# Hide cursor after 1 second of inactivity
unclutter -idle 1 -root &

# Start a simple window manager (needed for fullscreen)
openbox &

# Wait for window manager to start
sleep 2

# Start the kiosk Chrome
exec ~/kiosk/kiosk-chrome.sh
XINITRC
chmod +x "$KIOSK_HOME/.xinitrc"
chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.xinitrc"

# Set environment variables
echo "[4/6] Configuring environment..."
cat > "$KIOSK_DIR/environment" << EOF
KIOSK_URL=$KIOSK_URL
DISPLAY=:0
EOF
chown "$KIOSK_USER:$KIOSK_USER" "$KIOSK_DIR/environment"

# Update kiosk-chrome.sh to source environment
sed -i '3a\\n# Source environment variables\nif [[ -f ~/kiosk/environment ]]; then\n    source ~/kiosk/environment\nfi' "$KIOSK_DIR/kiosk-chrome.sh"

# Setup auto-login with getty
echo "[5/6] Configuring auto-login..."
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF

# Auto-start X on login
echo "[6/6] Configuring auto-start of X11..."
BASH_PROFILE="$KIOSK_HOME/.bash_profile"

# Check if auto-start is already configured
if ! grep -q "startx" "$BASH_PROFILE" 2>/dev/null; then
    cat >> "$BASH_PROFILE" << 'BASHPROFILE'

# Auto-start X11 on tty1
if [[ -z $DISPLAY ]] && [[ $(tty) = /dev/tty1 ]]; then
    exec startx -- -nocursor
fi
BASHPROFILE
    chown "$KIOSK_USER:$KIOSK_USER" "$BASH_PROFILE"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "The kiosk will automatically:"
echo "  1. Auto-login as '$KIOSK_USER' on boot"
echo "  2. Start X11 automatically"
echo "  3. Launch Chrome in kiosk mode"
echo "  4. Restart Chrome if it crashes"
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
echo "To disable kiosk mode:"
echo "  sudo rm /etc/systemd/system/getty@tty1.service.d/autologin.conf"
echo "  sudo systemctl daemon-reload"
