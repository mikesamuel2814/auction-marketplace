/**
 * PM2 ecosystem config for auction-marketplace.
 * Backend: BACKEND_PORT (default 5020)
 * Frontend: FRONTEND_PORT (default 3020)
 *
 * Start: BACKEND_PORT=5020 FRONTEND_PORT=3020 pm2 start ecosystem.config.cjs
 * Or: pm2 start ecosystem.config.cjs (uses defaults)
 */
const path = require('path');
const appDir = path.resolve(__dirname);

const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '5020', 10);
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '3020', 10);

module.exports = {
  apps: [
    {
      name: 'auction-backend',
      cwd: path.join(appDir, 'backend'),
      script: 'dist/index.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: String(BACKEND_PORT),
      },
      env_file: path.join(appDir, 'backend', '.env'),
      error_file: path.join(appDir, 'logs', 'backend-error.log'),
      out_file: path.join(appDir, 'logs', 'backend-out.log'),
      merge_logs: true,
    },
    {
      name: 'auction-frontend',
      cwd: path.join(appDir, 'frontend'),
      script: 'node_modules/.bin/next',
      args: ['start'],
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: String(FRONTEND_PORT),
      },
      error_file: path.join(appDir, 'logs', 'frontend-error.log'),
      out_file: path.join(appDir, 'logs', 'frontend-out.log'),
      merge_logs: true,
    },
  ],
};
