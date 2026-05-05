# Deployment

Blorox runs as a single Node process.

## Server Setup

```bash
mkdir -p ~/blorox
cd ~/blorox
npm start
```

By default the server listens on `0.0.0.0:8080`. Override this with:

```bash
PORT=80 npm start
```

## Production Process

Use either `systemd`, `pm2`, or a shell service manager. A minimal `systemd` unit:

```ini
[Unit]
Description=Blorox web platform
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/host/blorox
ExecStart=/usr/bin/env node server.js
Restart=always
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
```

## Networking

Expose the chosen port in the firewall. Multiplayer uses WebSocket upgrades on the same origin and path:

```text
/ws?room=<room-id>&token=<session-token>
```
