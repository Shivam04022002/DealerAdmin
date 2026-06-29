# AWS Production Setup — surjitfinance.com
**Ubuntu 24.04 LTS · Elastic IP: 65.2.212.239**

Architecture:
- `dealer.surjitfinance.com` → React Admin Frontend (Nginx static)
- `dealeradmin.surjitfinance.com` → Admin Backend Node.js (port 5001)
- `dealerapi.surjitfinance.com` → Mobile Backend Node.js (port 5000)

---

## 1. DNS Configuration (Route 53 / Your Registrar)

Add these A records pointing to your Elastic IP `65.2.212.239`:

| Record | Type | Value |
|--------|------|-------|
| `dealer.surjitfinance.com` | A | `65.2.212.239` |
| `dealeradmin.surjitfinance.com` | A | `65.2.212.239` |
| `dealerapi.surjitfinance.com` | A | `65.2.212.239` |

---

## 2. AWS Security Group (Inbound Rules)

Open these ports in the EC2 Security Group:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Your IP only | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP → HTTPS redirect |
| 443 | TCP | 0.0.0.0/0 | HTTPS |

> **Do NOT open ports 5000 or 5001** — Node.js listens on localhost only; Nginx proxies externally.

---

## 3. Server Initial Setup (run once as root/sudo)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # v20.x.x
npm -v    # 10.x.x

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Install Git
sudo apt install -y git

# Create directory structure
sudo mkdir -p /var/www/admin
sudo mkdir -p /var/www/mobile-backend
sudo mkdir -p /var/www/logs
sudo chown -R $USER:$USER /var/www
```

---

## 4. Deploy Application Code

```bash
# Clone or upload admin repo (contains admin-backend + admin-frontend)
cd /var/www/admin
git clone <your-admin-repo-url> .

# Clone or upload mobile backend
cd /var/www/mobile-backend
git clone <your-mobile-repo-url> .
# The server.js should be at: /var/www/mobile-backend/server/server.js

# Create .env files (see Section 5 below before this step)
```

---

## 5. Environment Files

### Admin Backend — `/var/www/admin/admin-backend/.env`
```env
NODE_ENV=production
PORT=5001
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority
JWT_SECRET=<your-64-char-random-secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://dealer.surjitfinance.com
```

### Mobile Backend — `/var/www/mobile-backend/server/.env`
```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority
JWT_SECRET=<your-64-char-random-secret>
CORS_ORIGIN=https://dealerapi.surjitfinance.com
CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
```

### Admin Frontend — `/var/www/admin/admin-frontend/.env.production`
```env
VITE_API_BASE_URL=https://dealeradmin.surjitfinance.com/api
```

> Generate a strong secret: `openssl rand -hex 32`

---

## 6. Install Dependencies & Build Frontend

```bash
# Admin Backend
cd /var/www/admin/admin-backend
npm install --omit=dev

# Mobile Backend
cd /var/www/mobile-backend/server
npm install --omit=dev

# Admin Frontend (build for production)
cd /var/www/admin/admin-frontend
npm install
npm run build
# Output: /var/www/admin/admin-frontend/dist/
```

---

## 7. PM2 — Start Both Node.js Applications

```bash
# Copy ecosystem config to server
cp /var/www/admin/ecosystem.config.cjs /var/www/admin/ecosystem.config.cjs

# Start both apps in production mode
cd /var/www/admin
pm2 start ecosystem.config.cjs --env production

# Save PM2 process list (survives reboots)
pm2 save

# Register PM2 to start on system boot
pm2 startup
# Copy and run the command it outputs (starts with: sudo env PATH=...)
```

---

## 8. Nginx Configuration

```bash
# Copy nginx config
sudo cp /var/www/admin/nginx.conf /etc/nginx/sites-available/surjitfinance

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Enable the new config
sudo ln -sf /etc/nginx/sites-available/surjitfinance /etc/nginx/sites-enabled/surjitfinance

# Test config syntax
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 9. SSL Certificates (Let's Encrypt / Certbot)

**Issue certificates for each subdomain separately** (required because each has its own `ssl_certificate` path in nginx.conf):

```bash
# Issue certificate for Admin Frontend
sudo certbot --nginx -d dealer.surjitfinance.com

# Issue certificate for Admin Backend
sudo certbot --nginx -d dealeradmin.surjitfinance.com

# Issue certificate for Mobile Backend
sudo certbot --nginx -d dealerapi.surjitfinance.com

# Reload Nginx after certificates are issued
sudo systemctl reload nginx

# Verify auto-renewal (Certbot installs a systemd timer automatically)
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

> **Important:** DNS must propagate before running Certbot. Verify with:
> `dig dealer.surjitfinance.com` — must return `65.2.212.239`

---

## 10. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw deny 5000
sudo ufw deny 5001
sudo ufw enable
sudo ufw status verbose
```

Expected output:
```
To                   Action      From
--                   ------      ----
OpenSSH              ALLOW IN    Anywhere
Nginx Full           ALLOW IN    Anywhere
5000                 DENY IN     Anywhere
5001                 DENY IN     Anywhere
```

---

## 11. Health Checks

Run these after deployment to verify everything is working:

```bash
# PM2 process status
pm2 status

# Admin Backend health
curl -s http://localhost:5001/api/health | python3 -m json.tool

# Mobile Backend health
curl -s http://localhost:5000/api/test | python3 -m json.tool

# HTTPS — Admin Frontend
curl -sI https://dealer.surjitfinance.com | head -5

# HTTPS — Admin Backend
curl -s https://dealeradmin.surjitfinance.com/api/health | python3 -m json.tool

# HTTPS — Mobile Backend
curl -s https://dealerapi.surjitfinance.com/api/test | python3 -m json.tool

# Check SSL certificate expiry
echo | openssl s_client -connect dealer.surjitfinance.com:443 2>/dev/null | openssl x509 -noout -dates
echo | openssl s_client -connect dealeradmin.surjitfinance.com:443 2>/dev/null | openssl x509 -noout -dates
echo | openssl s_client -connect dealerapi.surjitfinance.com:443 2>/dev/null | openssl x509 -noout -dates

# Nginx error log (last 50 lines)
sudo tail -50 /var/log/nginx/error.log

# PM2 logs
pm2 logs --lines 50
```

---

## 12. Ongoing Deployment

After pushing code changes to Git:

```bash
# Deploy everything
cd /var/www/admin
./deploy.sh

# Deploy only admin backend + frontend
./deploy.sh admin

# Deploy only mobile backend
./deploy.sh mobile

# Rebuild frontend only
./deploy.sh frontend
```

---

## 13. Production Checklist

### DNS & Network
- [ ] A record `dealer.surjitfinance.com` → `65.2.212.239` resolves correctly
- [ ] A record `dealeradmin.surjitfinance.com` → `65.2.212.239` resolves correctly
- [ ] A record `dealerapi.surjitfinance.com` → `65.2.212.239` resolves correctly
- [ ] Security Group: ports 80 and 443 open; ports 5000 and 5001 closed
- [ ] UFW firewall enabled

### SSL
- [ ] SSL certificate issued for `dealer.surjitfinance.com`
- [ ] SSL certificate issued for `dealeradmin.surjitfinance.com`
- [ ] SSL certificate issued for `dealerapi.surjitfinance.com`
- [ ] `certbot renew --dry-run` passes without error
- [ ] All three domains return HTTPS 200 (no mixed content warnings)

### Environment Variables
- [ ] `/var/www/admin/admin-backend/.env` created with correct `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`
- [ ] `/var/www/mobile-backend/server/.env` created with correct `MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_*`, `CORS_ORIGIN`
- [ ] No `.env` files committed to Git

### Applications
- [ ] `pm2 status` shows both `admin-backend` (port 5001) and `mobile-backend` (port 5000) as **online**
- [ ] `pm2 startup` + `pm2 save` completed (survives reboots)
- [ ] `http://localhost:5001/api/health` returns `{"status":"ok"}`
- [ ] `http://localhost:5000/api/test` returns `{"status":"success"}`
- [ ] Admin Frontend `dist/` built from `.env.production` (`VITE_API_BASE_URL=https://dealeradmin.surjitfinance.com/api`)

### Nginx
- [ ] `sudo nginx -t` passes
- [ ] `dealer.surjitfinance.com` serves React app (returns HTML)
- [ ] `dealeradmin.surjitfinance.com/api/health` proxies to admin backend correctly
- [ ] `dealerapi.surjitfinance.com/api/test` proxies to mobile backend correctly
- [ ] Old domain `surjithirepurchase.com` returns no response / connection refused

### Mobile App (DealerLogin)
- [ ] `config.js`: `IS_PRODUCTION = true`, `PRODUCTION_API = 'https://dealerapi.surjitfinance.com'`
- [ ] New production APK built and distributed to dealers

### Monitoring
- [ ] `/var/www/logs/` directory exists and is writable
- [ ] `pm2 logs` shows no crash loops or unhandled errors
- [ ] Nginx error log is clean (`sudo tail /var/log/nginx/error.log`)
