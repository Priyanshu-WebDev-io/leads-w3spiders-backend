#!/bin/bash

# ==========================================
# CRM Backend Deployment Script
# ==========================================
# This script deploys the CRM backend to production
# Run this on your Contabo VPS

set -e  # Exit on error

echo "🚀 Starting CRM Backend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  This script should be run with sudo for Docker operations${NC}"
fi

# Navigate to project directory
PROJECT_DIR="$HOME/w3spiders-crm/backend"
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
    exit 1
fi

cd "$PROJECT_DIR"
echo -e "${GREEN}✅ Changed to project directory: $PROJECT_DIR${NC}"

# Pull latest code
echo "📥 Pulling latest code from git..."
git pull origin main

# Check if .env.production exists
if [ ! -f "api/.env.production" ]; then
    echo -e "${RED}❌ api/.env.production not found!${NC}"
    echo "Please create it from api/.env.production.example"
    exit 1
fi

# Build scraper image
echo "🔨 Building scraper image..."
docker-compose -f docker-compose.production.yml build scraper-builder

# Stop existing containers
echo "🛑 Stopping existing CRM backend..."
docker-compose -f docker-compose.production.yml down

# Build and start new containers
echo "🏗️  Building and starting CRM backend..."
docker-compose -f docker-compose.production.yml up -d --build crm-backend

# Wait for container to be healthy
echo "⏳ Waiting for backend to be healthy..."
sleep 10

# Check container status
if docker ps | grep -q crm_backend; then
    echo -e "${GREEN}✅ CRM Backend is running${NC}"
    docker ps | grep crm_backend
else
    echo -e "${RED}❌ CRM Backend failed to start${NC}"
    echo "Last 50 lines of logs:"
    docker logs crm_backend --tail 50
    exit 1
fi

# Health check
echo "🏥 Running health check..."
sleep 5
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Health check returned status: $HEALTH_STATUS${NC}"
    echo "Backend may still be starting up. Check logs:"
    echo "docker logs crm_backend -f"
fi

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:    docker logs crm_backend -f"
echo "  Restart:      docker-compose -f docker-compose.production.yml restart crm-backend"
echo "  Stop:         docker-compose -f docker-compose.production.yml down"
echo "  Check status: docker ps | grep crm_backend"
echo ""
