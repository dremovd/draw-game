# CORS Proxy Server Setup Guide

This guide explains how to set up a **secure**, authenticated CORS proxy server on Ubuntu.

## 🔒 Security Features

This proxy is built with security in mind using native Node.js modules (no vulnerable dependencies):

- ✅ **No vulnerabilities** - Uses only Node.js built-in `http` and `https` modules
- 🔐 **API key authentication** - Prevents unauthorized access
- 🛡️ **SSRF protection** - Blocks access to internal/private IP addresses
- 🎯 **Domain whitelist** - Optional restriction to specific domains
- ⏱️ **Request timeouts** - Prevents hanging connections
- 🚫 **Cookie blocking** - Removes cookies from proxied requests

## Quick Start (Local Testing)

1. **No dependencies needed!** The server uses only Node.js built-ins.
   ```bash
   # Optionally run this to clean up old vulnerable packages
   rm -rf node_modules package-lock.json
   ```

2. **Run the server:**
   ```bash
   # Use default key
   npm start

   # Or set custom key
   API_KEY=your-secret-key-here npm start
   ```

3. **Test it:**
   ```bash
   curl "http://localhost:8080/?token=your-secret-key-here&https://httpbin.org/json"
   ```

## Ubuntu Server Installation

### 1. Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Set Up Project

```bash
# Create directory
mkdir -p ~/cors-proxy
cd ~/cors-proxy

# Copy the files (or clone your repo)
# You need: cors-proxy-server.js and package.json

# No dependencies needed - uses only Node.js built-ins!
```

### 3. Generate Secure API Key

```bash
# Generate a random secure key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this key - you'll need it for both server and client configuration.

### 4. Test the Server

```bash
# Run with your key
API_KEY=your-generated-key-here node cors-proxy-server.js
```

Visit: `http://your-server-ip:8080/?token=your-generated-key-here&https://httpbin.org/json`

### 5. Set Up as Systemd Service

```bash
# Create service file
sudo tee /etc/systemd/system/cors-proxy.service > /dev/null << EOF
[Unit]
Description=Authenticated CORS Proxy Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/cors-proxy
Environment="API_KEY=your-generated-key-here"
Environment="PORT=8080"
Environment="HOST=0.0.0.0"
ExecStart=/usr/bin/node cors-proxy-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable cors-proxy
sudo systemctl start cors-proxy

# Check status
sudo systemctl status cors-proxy

# View logs
sudo journalctl -u cors-proxy -f
```

### 6. Configure Firewall (if needed)

```bash
# Allow port 8080
sudo ufw allow 8080/tcp
sudo ufw reload
```

### 7. Optional: Set Up nginx Reverse Proxy (for HTTPS)

```bash
sudo apt-get install nginx certbot python3-certbot-nginx

# Create nginx config
sudo tee /etc/nginx/sites-available/cors-proxy > /dev/null << 'EOF'
server {
    listen 80;
    server_name proxy.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/cors-proxy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d proxy.yourdomain.com
```

## Using the Proxy

### In Your HTML Application

The proxy URL format is:
```
http://your-server:8080/?token=YOUR_API_KEY&
```

Example configuration:
- **Proxy URL:** `http://your-server:8080/?token=your-key&`
- Or use separate fields:
  - **Proxy URL:** `http://your-server:8080/?`
  - **Proxy Token:** `your-key`

### URL Parameters for Easy Sharing

The application is hosted at: **https://draw.bestboardga.me/**

```
https://draw.bestboardga.me/?apiKey=poe-api-key&proxy=http://your-server:8080/?&proxyToken=your-key
```

Example with all parameters:
```
https://draw.bestboardga.me/?apiKey=eQhrryKWthTcOMpeXmejsNDIJmNy5csGTo5XYKdbaZI&proxy=http://your-server:8080/?&proxyToken=your-proxy-key
```

## Security Recommendations

1. **Use strong API keys:** Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. **Use HTTPS:** Set up nginx with SSL certificates (via Let's Encrypt)
3. **Restrict access:** Use firewall rules to limit which IPs can access the proxy
4. **Enable domain whitelist:** Set `ALLOWED_DOMAINS=api.poe.com,example.com` to restrict target domains
5. **Monitor usage:** Check logs regularly with `sudo journalctl -u cors-proxy`
6. **Rotate keys:** Change API keys periodically

### Advanced: Domain Whitelist

To restrict the proxy to only specific domains:

```bash
# In systemd service or when running
ALLOWED_DOMAINS="api.poe.com,generativelanguage.googleapis.com" API_KEY=your-key node cors-proxy-server.js
```

Or in the systemd service file:
```
Environment="ALLOWED_DOMAINS=api.poe.com,generativelanguage.googleapis.com"
```

## Troubleshooting

### Server won't start
```bash
# Check logs
sudo journalctl -u cors-proxy -n 50

# Check if port is in use
sudo lsof -i :8080
```

### Connection refused
```bash
# Check if service is running
sudo systemctl status cors-proxy

# Check firewall
sudo ufw status
```

### 401 Unauthorized
- Verify the API key matches on both server and client
- Check for extra spaces or hidden characters in the key
- Try using `X-API-Key` header instead of query parameter

## Managing the Service

```bash
# Start
sudo systemctl start cors-proxy

# Stop
sudo systemctl stop cors-proxy

# Restart
sudo systemctl restart cors-proxy

# View logs
sudo journalctl -u cors-proxy -f

# Disable autostart
sudo systemctl disable cors-proxy
```
