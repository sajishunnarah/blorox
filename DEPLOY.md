# Deployment

Blorox runs as a single Node process.

## Current Production

- URL: `http://blorox.50.116.38.29.sslip.io`
- App path: `/opt/blorox`
- Data path: `/var/lib/blorox/state.json`
- Service: `blorox.service`
- Internal app port: `127.0.0.1:8097`
- Public proxy: nginx on port 80 with WebSocket upgrade forwarding

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

Use either `systemd`, `pm2`, or a shell service manager. The deployed server uses this `systemd` unit shape:

```ini
[Unit]
Description=Blorox web platform
After=network.target

[Service]
Type=simple
User=blorox
Group=blorox
WorkingDirectory=/opt/blorox
ExecStart=/usr/bin/node /opt/blorox/server.js
Restart=always
Environment=HOST=127.0.0.1
Environment=PORT=8097
Environment=BLOROX_DATA_DIR=/var/lib/blorox

[Install]
WantedBy=multi-user.target
```

## Networking

Expose the chosen port directly, or place nginx in front of the Node process. Multiplayer uses WebSocket upgrades on the same origin and path:

```text
/ws?room=<room-id>&token=<session-token>
```
