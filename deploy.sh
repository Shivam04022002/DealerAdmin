#!/bin/bash

# Deploy Script for Admin Panel
# Run this script on your server to update the application

set -e  # Exit on any error

echo "=========================================="
echo "  Admin Panel Deployment Script"
echo "=========================================="

APP_DIR="/var/www/admin"
cd $APP_DIR

echo ""
echo "[1/5] Pulling latest changes from Git..."
git pull origin main

echo ""
echo "[2/5] Installing backend dependencies..."
cd admin-backend
npm install --production
cd ..

echo ""
echo "[3/5] Building frontend..."
cd admin-frontend
npm install
npm run build
cd ..

echo ""
echo "[4/5] Restarting backend with PM2..."
pm2 reload ecosystem.config.cjs --env production

echo ""
echo "[5/5] Verifying deployment..."
sleep 3
pm2 status

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Health check: curl http://localhost:5001/api/health"
echo ""
