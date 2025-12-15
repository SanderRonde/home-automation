#!/bin/bash
# Setup script for daily chromium killer
# This creates a systemd timer that runs the kill-chromium.sh script once per day
# Must be run as root

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root"
    echo "Please run: sudo $0"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KILL_SCRIPT="$SCRIPT_DIR/kill-chromium.sh"

# Make the kill script executable
chmod +x "$KILL_SCRIPT"

# Create systemd service file
SERVICE_FILE="/etc/systemd/system/kill-chromium.service"
TIMER_FILE="/etc/systemd/system/kill-chromium.timer"

echo "Creating systemd service file at $SERVICE_FILE"
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Kill Chromium processes daily
After=network.target

[Service]
Type=oneshot
ExecStart=$KILL_SCRIPT
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "Creating systemd timer file at $TIMER_FILE"
cat > "$TIMER_FILE" << EOF
[Unit]
Description=Daily Chromium Killer Timer
Requires=kill-chromium.service

[Timer]
# Run daily at 3 AM
OnCalendar=daily
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling and starting timer..."
systemctl enable kill-chromium.timer
systemctl start kill-chromium.timer

echo ""
echo "Setup complete!"
echo ""
echo "Useful commands:"
echo "  Check timer status:  systemctl status kill-chromium.timer"
echo "  Check service logs:  journalctl -u kill-chromium.service"
echo "  List all timers:     systemctl list-timers"
echo "  Disable timer:       systemctl disable kill-chromium.timer"
echo "  Stop timer:          systemctl stop kill-chromium.timer"
echo "  Run manually:        systemctl start kill-chromium.service"
echo ""
echo "The script will run daily at 3 AM and logs to /var/log/kill-chromium.log"
