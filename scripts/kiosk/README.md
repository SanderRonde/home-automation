# Chrome Kiosk Mode Setup for Arch Linux

This directory contains scripts to run Chrome in kiosk mode with automatic recovery from page crashes and auto-start on boot.

## Features

- **Auto-reload on page crash**: Detects renderer/page crashes (like SIGILL) and automatically reloads
- **Auto-restart Chrome**: Restarts Chrome if the browser process itself dies
- **Auto-login**: No manual login required on boot
- **Auto-start**: X11 with i3 and Chrome start automatically on boot
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
sudo pacman -S xorg-server xorg-xinit xorg-xset chromium i3-wm unclutter curl
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
i3 &
sleep 2
exec ~/kiosk/kiosk-chrome.sh
```

Make it executable: `chmod +x ~/.xinitrc`

#### 5. Create i3 Kiosk Config

Create `~/.config/i3/config`:
```
default_border none
default_floating_border none
bar {
    mode invisible
}
for_window [class=".*"] border pixel 0
for_window [class=".*"] fullscreen enable
```

#### 6. Configure Auto-Login

Create `/etc/systemd/system/getty@tty1.service.d/autologin.conf`:
```ini
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin YOUR_USERNAME --noclear %I $TERM
```

#### 7. Configure Auto-Start X11

Add to `~/.bash_profile`:
```bash
if [[ -z $DISPLAY ]] && [[ $(tty) = /dev/tty1 ]]; then
    exec startx -- -nocursor
fi
```

## How Page Crash Recovery Works

When a page crashes in Chrome (e.g., due to SIGILL in the renderer process), Chrome itself keeps running but displays "Aw, Snap!". The script detects this using Chrome DevTools Protocol:

1. Chrome is started with `--remote-debugging-port=9222`
2. A monitor checks the page status every 5 seconds via CDP
3. If a crash is detected (empty title, "Aw, Snap!", or chrome-error://), the page is reloaded
4. If Chrome itself dies, it's restarted automatically

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KIOSK_URL` | `http://localhost:3000/dashboard#home-kiosk` | URL to display |
| `DISPLAY` | `:0` | X11 display number |
| `RESTART_DELAY` | `3` | Seconds to wait before restarting after Chrome crash |
| `CHROME_BIN` | Auto-detected | Path to Chrome/Chromium binary |
| `DEBUG_PORT` | `9222` | Chrome DevTools Protocol port |
| `CRASH_CHECK_INTERVAL` | `5` | Seconds between page crash checks |

### Changing the URL

Edit `~/kiosk/environment`:
```bash
KIOSK_URL=http://your-server:3000/dashboard#home-kiosk
```

## Troubleshooting

### Page crashes with SIGILL

This is often caused by:
1. **JavaScript/WASM using unsupported CPU instructions**
2. **GPU driver issues in the renderer**: Try adding `--disable-gpu` to Chrome flags
3. **Memory pressure**: Ensure sufficient RAM is available

The wrapper script will automatically detect the crash and reload the page.

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
journalctl -f
```

### Test page crash detection

You can trigger a renderer crash for testing:
```bash
# In a browser, navigate to:
chrome://crash
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
```

## Files

| File | Description |
|------|-------------|
| `kiosk-chrome.sh` | Main wrapper script that runs Chrome, monitors for page crashes, and auto-reloads |
| `kiosk.service` | Systemd user service (alternative to getty approach) |
| `setup-kiosk.sh` | Automated setup script (run as root) |
