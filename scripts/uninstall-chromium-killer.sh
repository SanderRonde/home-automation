#!/bin/bash
# Uninstall script for daily chromium killer
# This removes the systemd timer and service files
# Must be run as root

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root"
    echo "Please run: sudo $0"
    exit 1
fi

SERVICE_FILE="/etc/systemd/system/kill-chromium.service"
TIMER_FILE="/etc/systemd/system/kill-chromium.timer"
LOG_FILE="/var/log/kill-chromium.log"

echo "Uninstalling Chromium Killer..."
echo ""

# Stop and disable the timer
if systemctl is-active --quiet kill-chromium.timer; then
    echo "Stopping timer..."
    systemctl stop kill-chromium.timer
else
    echo "Timer is not running"
fi

if systemctl is-enabled --quiet kill-chromium.timer 2>/dev/null; then
    echo "Disabling timer..."
    systemctl disable kill-chromium.timer
else
    echo "Timer is not enabled"
fi

# Remove systemd files
if [ -f "$SERVICE_FILE" ]; then
    echo "Removing service file: $SERVICE_FILE"
    rm "$SERVICE_FILE"
else
    echo "Service file not found (already removed?)"
fi

if [ -f "$TIMER_FILE" ]; then
    echo "Removing timer file: $TIMER_FILE"
    rm "$TIMER_FILE"
else
    echo "Timer file not found (already removed?)"
fi

# Reload systemd daemon
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Ask about log file
if [ -f "$LOG_FILE" ]; then
    echo ""
    read -p "Remove log file ($LOG_FILE)? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm "$LOG_FILE"
        echo "Log file removed"
    else
        echo "Log file kept"
    fi
else
    echo "Log file not found"
fi

echo ""
echo "Uninstall complete!"
echo ""
echo "Verifying removal..."
if systemctl list-timers | grep -q chromium; then
    echo "⚠ Warning: Timer still appears in list"
else
    echo "✓ Timer successfully removed"
fi

echo ""
echo "The script files in scripts/ directory are still present."
echo "You can delete them manually if desired:"
echo "  rm scripts/kill-chromium.sh"
echo "  rm scripts/setup-chromium-killer.sh"
echo "  rm scripts/uninstall-chromium-killer.sh"
echo "  rm scripts/CHROMIUM_KILLER_README.md"
echo ""
