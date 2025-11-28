#!/bin/bash
# Disable Kiosk Mode - Recovery Script
# Run this to stop the boot loop and disable auto-start

set -e

if [[ $EUID -ne 0 ]]; then
    echo "This script must be run as root (sudo)"
    exit 1
fi

KIOSK_USER="${1:-}"

if [[ -z "$KIOSK_USER" ]]; then
    echo "Usage: $0 <username>"
    echo ""
    echo "This will disable auto-login and auto-start of X11"
    exit 1
fi

KIOSK_HOME=$(eval echo "~$KIOSK_USER")

echo "=== Disabling Kiosk Mode ==="
echo "User: $KIOSK_USER"
echo ""

# Check for LightDM autologin
LIGHTDM_AUTOLOGIN_USER=""
if [[ -f /etc/lightdm/lightdm.conf ]]; then
    LIGHTDM_AUTOLOGIN_USER=$(grep -E "^autologin-user=" /etc/lightdm/lightdm.conf | cut -d= -f2 | tr -d ' ')
    if [[ -n "$LIGHTDM_AUTOLOGIN_USER" ]]; then
        echo "[0/4] Found LightDM autologin for user: $LIGHTDM_AUTOLOGIN_USER"
    fi
fi

# Disable LightDM autologin
echo "[1/4] Disabling LightDM autologin..."
if [[ -f /etc/lightdm/lightdm.conf ]]; then
    # Comment out autologin lines
    sed -i 's/^autologin-user=/#autologin-user=/' /etc/lightdm/lightdm.conf
    sed -i 's/^autologin-session=/#autologin-session=/' /etc/lightdm/lightdm.conf
    sed -i 's/^autologin-user-timeout=/#autologin-user-timeout=/' /etc/lightdm/lightdm.conf
    echo "  ✓ LightDM autologin disabled"
else
    echo "  ✓ LightDM config not found"
fi

# Disable getty auto-login
echo "[2/4] Disabling getty auto-login..."
if [[ -f /etc/systemd/system/getty@tty1.service.d/autologin.conf ]]; then
    rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf
    systemctl daemon-reload
    echo "  ✓ Getty auto-login disabled"
else
    echo "  ✓ Getty auto-login already disabled"
fi

# Disable auto-start X11 in .bash_profile
echo "[3/4] Disabling auto-start X11..."
if [[ -f "$KIOSK_HOME/.bash_profile" ]]; then
    # Remove the auto-start section
    sed -i '/# Auto-start X11 on tty1/,/^fi$/d' "$KIOSK_HOME/.bash_profile" 2>/dev/null || true
    echo "  ✓ Auto-start X11 disabled in .bash_profile"
else
    echo "  ✓ No .bash_profile found"
fi

# Backup .xinitrc instead of deleting (in case user wants to restore)
echo "[4/4] Backing up .xinitrc..."
if [[ -f "$KIOSK_HOME/.xinitrc" ]]; then
    mv "$KIOSK_HOME/.xinitrc" "$KIOSK_HOME/.xinitrc.kiosk-backup" 2>/dev/null || true
    echo "  ✓ .xinitrc backed up to .xinitrc.kiosk-backup"
else
    echo "  ✓ No .xinitrc found"
fi

echo ""
echo "=== Kiosk Mode Disabled ==="
echo ""
echo "The following have been disabled:"
echo "  - LightDM autologin"
echo "  - Getty autologin"
echo "  - Auto-start X11 in .bash_profile"
echo ""
echo "LightDM will still run but will show the login screen."
echo "To completely disable LightDM (if using getty/startx approach):"
echo "  sudo systemctl disable lightdm.service"
echo "  sudo systemctl stop lightdm.service"
echo ""
echo "You can now reboot or switch to another TTY safely."
echo ""
echo "To restore kiosk mode later, run setup-kiosk.sh again."
echo ""
echo "To view X11 error logs, check:"
echo "  ~/.xsession-errors"
echo "  journalctl -u lightdm"
echo "  journalctl -u getty@tty1"
echo ""

