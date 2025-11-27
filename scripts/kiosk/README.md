# Chrome Kiosk Mode Setup for Arch Linux

This directory contains scripts to run Chrome in kiosk mode with automatic restart on crash and auto-start on boot.

## Features

- **Auto-restart on crash**: Chrome restarts automatically when it crashes (including SIGILL, SIGSEGV, etc.)
- **Auto-login**: No manual login required on boot
- **Auto-start**: X11 and Chrome start automatically on boot
- **Fullscreen kiosk**: Chrome runs in true fullscreen kiosk mode
- **Hidden cursor**: Mouse cursor hides after 1 second of inactivity
- **No screen saver**: Screen stays on indefinitely

## Quick Setup

### Automatic Setup (Recommended)

```bash
# As root:
sudo ./setup-kiosk.sh <username> [kiosk-url]

# Example:
sudo ./setup-kiosk.sh pi http://localhost:3000/dashboard#home-kiosk
```

Then reboot.

### Manual Setup

#### 1. Install Dependencies

```bash
sudo pacman -S xorg-server xorg-xinit xorg-xset chromium openbox unclutter
```

#### 2. Copy Kiosk Script

```bash
mkdir -p ~/kiosk
cp kiosk-chrome.sh ~/kiosk/
chmod +x ~/kiosk/kiosk-chrome.sh
```

#### 3. Configure Environment

Create `~/kiosk/environment`:
```bash
KIOSK_URL=http://localhost:3000/dashboard#home-kiosk
DISPLAY=:0
```

#### 4. Create ~/.xinitrc

```bash
#!/bin/bash
xset s off
xset s noblank
xset -dpms
unclutter -idle 1 -root &
openbox &
sleep 2
exec ~/kiosk/kiosk-chrome.sh
```

Make it executable: `chmod +x ~/.xinitrc`

#### 5. Configure Auto-Login

Create `/etc/systemd/system/getty@tty1.service.d/autologin.conf`:
```ini
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin YOUR_USERNAME --noclear %I $TERM
```

#### 6. Configure Auto-Start X11

Add to `~/.bash_profile`:
```bash
if [[ -z $DISPLAY ]] && [[ $(tty) = /dev/tty1 ]]; then
    exec startx -- -nocursor
fi
```

## Wayland Alternative (cage)

If you prefer Wayland over X11, you can use `cage` (a Wayland kiosk compositor):

```bash
# Install cage
sudo pacman -S cage

# Create a systemd service for cage
sudo tee /etc/systemd/system/kiosk.service << 'EOF'
[Unit]
Description=Chrome Kiosk (Wayland)
After=systemd-user-sessions.service
Wants=systemd-user-sessions.service

[Service]
Type=simple
User=YOUR_USERNAME
Environment=XDG_RUNTIME_DIR=/run/user/1000
ExecStart=/usr/bin/cage -s chromium --kiosk --noerrdialogs --disable-infobars http://localhost:3000/dashboard#home-kiosk
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
sudo systemctl enable kiosk.service
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KIOSK_URL` | `http://localhost:3000/dashboard#home-kiosk` | URL to display |
| `DISPLAY` | `:0` | X11 display number |
| `RESTART_DELAY` | `3` | Seconds to wait before restarting after crash |
| `CHROME_BIN` | Auto-detected | Path to Chrome/Chromium binary |

### Changing the URL

Edit `~/kiosk/environment`:
```bash
KIOSK_URL=http://your-server:3000/dashboard#home-kiosk
```

## Troubleshooting

### Chrome crashes with SIGILL

This is often caused by:
1. **CPU compatibility issues**: Chrome may use CPU instructions not supported by your processor
2. **GPU driver issues**: Try adding `--disable-gpu` to Chrome flags
3. **Memory issues**: Ensure sufficient RAM is available

The wrapper script will automatically restart Chrome when this happens.

### Screen goes blank

Ensure power management is disabled:
```bash
xset s off
xset s noblank
xset -dpms
```

### Chrome won't start after crash

The wrapper script cleans up lock files automatically. If needed, manually remove:
```bash
rm -f ~/.config/chromium-kiosk/Singleton*
```

### View logs

```bash
# If using systemd user service
journalctl --user -u kiosk -f

# If using the getty approach
journalctl -f
```

### Test without reboot

```bash
# Restart getty to trigger auto-login
sudo systemctl restart getty@tty1
```

## Disabling Kiosk Mode

```bash
# Remove auto-login
sudo rm /etc/systemd/system/getty@tty1.service.d/autologin.conf
sudo systemctl daemon-reload

# Or if using systemd service
sudo systemctl disable kiosk.service
```

## Files

| File | Description |
|------|-------------|
| `kiosk-chrome.sh` | Main wrapper script that runs Chrome and restarts on crash |
| `kiosk.service` | Systemd user service (alternative to getty approach) |
| `setup-kiosk.sh` | Automated setup script (run as root) |
