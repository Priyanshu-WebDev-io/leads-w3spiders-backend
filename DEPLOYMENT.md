# W3Spiders CRM Backend - Production Deployment Guide

Complete guide for deploying the CRM backend to Contabo VPS at `api.leads.w3spiders.com`.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial VPS Setup](#initial-vps-setup)
3. [GitHub Repository Setup](#github-repository-setup)
4. [Manual Deployment](#manual-deployment)
5. [CI/CD Deployment](#cicd-deployment)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### What You Need

- ✅ Contabo VPS with Docker and Nginx already installed (from ASP deployment)
- ✅ Domain `api.leads.w3spiders.com` pointing to your VPS IP
- ✅ MongoDB Atlas account with CRM database
- ✅ Cloudinary account for file storage
- ✅ GitHub repository with the code
- ✅ SSH access to your VPS

### Required Accounts

1. **MongoDB Atlas** (free tier works)
   - Sign up: https://cloud.mongodb.com
   - Create a cluster and database
   - Get connection string

2. **Cloudinary** (free tier works)
   - Sign up: https://cloudinary.com
   - Get cloud name, API key, and API secret

---

## Initial VPS Setup

### 1. Clone Repository on VPS

SSH into your Contabo VPS:

```bash
ssh root@your-vps-ip
```

Clone the repository:

```bash
cd ~
git clone https://github.com/your-username/w3spiders-crm.git
cd w3spiders-crm/backend
```

### 2. Configure Nginx

Copy the Nginx configuration:

```bash
sudo cp scripts/nginx-crm.conf /etc/nginx/sites-available/crm
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
```

Test Nginx configuration:

```bash
sudo nginx -t
```

Obtain SSL certificate:

```bash
sudo certbot --nginx -d api.leads.w3spiders.com
```

Reload Nginx:

```bash
sudo systemctl reload nginx
```

### 3. Create Production Environment File

Create the production environment file:

```bash
cd ~/w3spiders-crm/backend/api
cp .env.production.example .env.production
nano .env.production
```

Fill in your actual values:

```bash
NODE_ENV=production
PORT=3000

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/scraper_db?retryWrites=true&w=majority

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Scraper Configuration
SCRAPER_IMAGE=scraper-image:latest
MAX_RESULTS=70
CLEANUP_TEMP=true
DATA_DIR=/app/scraper_data
SCRAPER_VOLUME_NAME=scraper_data

# Scheduler (Optional)
ENABLE_SCHEDULER=false
SCHEDULE_CRON=0 0 * * *
SCHEDULED_QUERIES=restaurants in Jaipur,hotels in Jaipur

# Resource Limits
NODE_OPTIONS=--max-old-space-size=460

# Google PageSpeed API (Optional)
GOOGLE_PAGESPEED_API_KEY=your-api-key-here
```

Save and exit (`Ctrl+X`, then `Y`, then `Enter`).

### 4. Initial Deployment

Run the deployment script:

```bash
cd ~/w3spiders-crm/backend
chmod +x scripts/deploy.sh
sudo ./scripts/deploy.sh
```

This will:
- Build the scraper image
- Build and start the CRM backend
- Run health checks
- Clean up old images

### 5. Verify Deployment

Check if the backend is running:

```bash
docker ps | grep crm_backend
```

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Test via HTTPS:

```bash
curl https://api.leads.w3spiders.com/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-02-14T..."}
```

---

## GitHub Repository Setup

### 1. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `VPS_HOST` | Your VPS IP address | `123.45.67.89` |
| `VPS_USERNAME` | SSH username | `root` |
| `VPS_SSH_KEY` | Private SSH key | `-----BEGIN RSA PRIVATE KEY-----...` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `your-cloud-name` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `abcdefghijklmnopqrstuvwxyz` |
| `GOOGLE_PAGESPEED_API_KEY` | Google PageSpeed API key (optional) | `AIza...` |

### 2. Get Your SSH Private Key

On your local machine:

```bash
cat ~/.ssh/id_rsa
```

Copy the entire output (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`) and paste it as the `VPS_SSH_KEY` secret.

**Note**: If you don't have an SSH key, generate one:

```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

Then copy the public key to your VPS:

```bash
ssh-copy-id root@your-vps-ip
```

---

## Manual Deployment

For manual deployments (without GitHub Actions):

### On Your VPS

```bash
cd ~/w3spiders-crm/backend
git pull origin main
sudo ./scripts/deploy.sh
```

The script will:
1. Pull latest code
2. Build Docker images
3. Restart containers
4. Run health checks
5. Clean up old images

---

## CI/CD Deployment

### Automatic Deployment

Once GitHub Secrets are configured, deployments happen automatically:

1. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Update backend"
   git push origin main
   ```

2. **GitHub Actions will**:
   - Checkout code
   - SSH into your VPS
   - Create `.env.production` with secrets
   - Pull latest code
   - Build and restart containers
   - Run health checks
   - Report status

3. **Monitor deployment**:
   - Go to GitHub → Actions tab
   - Click on the latest workflow run
   - Watch the deployment progress

### Manual Trigger

You can also trigger deployment manually:

1. Go to GitHub → Actions
2. Select "Deploy to Contabo VPS" workflow
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

---

## Monitoring & Maintenance

### View Logs

```bash
# Real-time logs
docker logs crm_backend -f

# Last 100 lines
docker logs crm_backend --tail 100

# Logs since 1 hour ago
docker logs crm_backend --since 1h
```

### Check Container Status

```bash
# List running containers
docker ps | grep crm

# Check resource usage
docker stats crm_backend

# Inspect container
docker inspect crm_backend
```

### Restart Backend

```bash
cd ~/w3spiders-crm/backend
docker-compose -f docker-compose.production.yml restart crm-backend
```

### Stop Backend

```bash
cd ~/w3spiders-crm/backend
docker-compose -f docker-compose.production.yml down
```

### Start Backend

```bash
cd ~/w3spiders-crm/backend
docker-compose -f docker-compose.production.yml up -d crm-backend
```

### Update Environment Variables

1. Edit the file:
   ```bash
   nano ~/w3spiders-crm/backend/api/.env.production
   ```

2. Restart the backend:
   ```bash
   cd ~/w3spiders-crm/backend
   docker-compose -f docker-compose.production.yml restart crm-backend
   ```

---

## Troubleshooting

### Backend Won't Start

**Check logs**:
```bash
docker logs crm_backend --tail 50
```

**Common issues**:

1. **MongoDB connection failed**:
   - Verify `MONGODB_URI` in `.env.production`
   - Check MongoDB Atlas network access (whitelist VPS IP)
   - Test connection: `curl -I https://cloud.mongodb.com`

2. **Port 3000 already in use**:
   ```bash
   sudo lsof -i :3000
   # Kill the process if needed
   sudo kill -9 <PID>
   ```

3. **Docker socket permission denied**:
   ```bash
   sudo usermod -aG docker $USER
   # Logout and login again
   ```

### Health Check Fails

**Test locally**:
```bash
curl http://localhost:3000/health
```

**Test via Nginx**:
```bash
curl https://api.leads.w3spiders.com/health
```

**Check Nginx logs**:
```bash
sudo tail -f /var/log/nginx/crm_error.log
```

### SSL Certificate Issues

**Check certificate**:
```bash
sudo certbot certificates
```

**Renew certificate**:
```bash
sudo certbot renew
```

**Test SSL**:
```bash
curl -I https://api.leads.w3spiders.com
```

### GitHub Actions Deployment Fails

1. **Check workflow logs** in GitHub Actions tab

2. **Common issues**:
   - SSH key incorrect → Re-add `VPS_SSH_KEY` secret
   - VPS unreachable → Check VPS is running and firewall allows SSH
   - Git pull fails → Check repository permissions on VPS

3. **Test SSH connection locally**:
   ```bash
   ssh root@your-vps-ip
   ```

---

## Rollback Procedures

### Rollback to Previous Version

1. **Find previous commit**:
   ```bash
   git log --oneline -n 10
   ```

2. **Checkout previous commit**:
   ```bash
   cd ~/w3spiders-crm/backend
   git checkout <commit-hash>
   ```

3. **Redeploy**:
   ```bash
   sudo ./scripts/deploy.sh
   ```

4. **Return to main branch** (after verifying):
   ```bash
   git checkout main
   ```

### Emergency Stop

```bash
cd ~/w3spiders-crm/backend
docker-compose -f docker-compose.production.yml down
```

### Quick Restart

```bash
cd ~/w3spiders-crm/backend
docker-compose -f docker-compose.production.yml restart crm-backend
```

---

## Useful Commands Reference

```bash
# Deployment
sudo ./scripts/deploy.sh

# Logs
docker logs crm_backend -f
docker logs crm_backend --tail 100

# Status
docker ps | grep crm
docker stats crm_backend

# Restart
docker-compose -f docker-compose.production.yml restart crm-backend

# Stop
docker-compose -f docker-compose.production.yml down

# Start
docker-compose -f docker-compose.production.yml up -d crm-backend

# Health check
curl https://api.leads.w3spiders.com/health

# Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/crm_error.log

# SSL
sudo certbot certificates
sudo certbot renew

# Clean up
docker system prune -a
```

---

## Security Best Practices

1. **Never commit `.env.production`** to git (already in `.gitignore`)
2. **Rotate secrets regularly** (MongoDB password, API keys)
3. **Keep VPS updated**: `sudo apt update && sudo apt upgrade`
4. **Monitor logs** for suspicious activity
5. **Use strong passwords** for all services
6. **Enable firewall**: `sudo ufw status`
7. **Regular backups** of MongoDB data

---

## Support

- **Backend logs**: `docker logs crm_backend -f`
- **Nginx logs**: `sudo tail -f /var/log/nginx/crm_error.log`
- **MongoDB Atlas**: Check dashboard for connection issues
- **Cloudinary**: Check dashboard for upload issues

---

**Last Updated**: 2026-02-14
