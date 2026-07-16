// PM2 Ecosystem Configuration — surjitfinance.com Production
// Usage:
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save
//   pm2 startup

module.exports = {
  apps: [
    // -------------------------------------------------------------------------
    // Admin Backend — dealeradmin.surjitfinance.com → port 5001
    // -------------------------------------------------------------------------
    {
      name: 'admin-backend',
      cwd: '/var/www/admin/admin-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 5001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
        // The admin SPA is served from the dealeradmin host and calls /api/ on
        // that same host; browsers send Origin on same-origin POSTs, so it must
        // be listed here or logins are rejected.
        CORS_ORIGIN: 'https://dealeradmin.surjitfinance.com,https://dealer.surjitfinance.com'
      },
      error_file: '/var/www/logs/admin-backend-error.log',
      out_file:   '/var/www/logs/admin-backend-out.log',
      log_file:   '/var/www/logs/admin-backend-combined.log',
      time: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s'
    },

    // -------------------------------------------------------------------------
    // Mobile Backend — dealerapi.surjitfinance.com → port 5000
    // -------------------------------------------------------------------------
    {
      name: 'mobile-backend',
      cwd: '/var/www/mobile-backend/server',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        CORS_ORIGIN: 'https://dealerapi.surjitfinance.com'
      },
      error_file: '/var/www/logs/mobile-backend-error.log',
      out_file:   '/var/www/logs/mobile-backend-out.log',
      log_file:   '/var/www/logs/mobile-backend-combined.log',
      time: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
