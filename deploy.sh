#!/bin/bash
# =============================================================================
# Production Deploy Script — surjitfinance.com
# AWS Ubuntu 24.04
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh              # deploys all three services
#   ./deploy.sh admin        # redeploys admin-backend + frontend only
#   ./deploy.sh mobile       # redeploys mobile-backend only
#   ./deploy.sh frontend     # rebuilds and redeploys frontend only
# =============================================================================

set -e

ADMIN_DIR="/var/www/admin"
MOBILE_DIR="/var/www/mobile-backend"
LOG_DIR="/var/www/logs"
TARGET="${1:-all}"

print_header() {
  echo ""
  echo "=========================================="
  echo "  $1"
  echo "=========================================="
}

print_step() {
  echo ""
  echo ">>> $1"
}

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# -----------------------------------------------------------------------
deploy_admin_backend() {
  print_step "Deploying Admin Backend (port 5001)..."
  cd "$ADMIN_DIR/admin-backend"
  npm install --omit=dev
  pm2 reload ecosystem.config.cjs --only admin-backend --env production
  print_step "Admin Backend deployed."
}

deploy_mobile_backend() {
  print_step "Deploying Mobile Backend (port 5000)..."
  cd "$MOBILE_DIR/server"
  npm install --omit=dev
  pm2 reload /var/www/admin/ecosystem.config.cjs --only mobile-backend --env production
  print_step "Mobile Backend deployed."
}

deploy_frontend() {
  print_step "Building Admin Frontend..."
  cd "$ADMIN_DIR/admin-frontend"
  npm install
  npm run build
  print_step "Frontend built → dist/ ready to be served by Nginx."
}

verify() {
  print_step "Verifying services..."
  sleep 3
  pm2 status

  echo ""
  echo "--- Health Checks ---"
  echo -n "Admin  Backend (5001): "
  curl -sf http://localhost:5001/api/health && echo " OK" || echo " FAIL"

  echo -n "Mobile Backend (5000): "
  curl -sf http://localhost:5000/api/test   && echo " OK" || echo " FAIL"

  echo -n "Nginx: "
  sudo nginx -t 2>&1 | tail -1
}
# -----------------------------------------------------------------------

print_header "surjitfinance.com — Production Deploy ($TARGET)"

case "$TARGET" in
  admin)
    deploy_admin_backend
    deploy_frontend
    ;;
  mobile)
    deploy_mobile_backend
    ;;
  frontend)
    deploy_frontend
    ;;
  all | *)
    print_step "Pulling latest changes..."
    cd "$ADMIN_DIR"
    git pull origin main

    deploy_admin_backend
    deploy_mobile_backend
    deploy_frontend
    ;;
esac

verify

print_header "Deploy Complete!"
echo ""
echo "  dealer.surjitfinance.com      → Admin Frontend"
echo "  dealeradmin.surjitfinance.com → Admin Backend  (port 5001)"
echo "  dealerapi.surjitfinance.com   → Mobile Backend (port 5000)"
echo ""
