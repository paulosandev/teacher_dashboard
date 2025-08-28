module.exports = {
  apps: [
    {
      // Aplicación principal Next.js
      name: 'next-app',
      script: 'npm',
      args: 'start',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ENABLE_CRON: 'true'  // ✅ Habilita los cron jobs
      },
      error_file: './logs/app-error.log',
      out_file: './logs/app-out.log',
      log_file: './logs/app-combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true
    },
    {
      // Worker de análisis
      name: 'profebot-worker',
      script: 'tsx',
      args: 'workers/analysis-worker.ts',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true,
      max_memory_restart: '500M',
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true
    },
    {
      // Worker de auto-actualización (opcional)
      name: 'profebot-auto-update',
      script: 'tsx',
      args: 'workers/auto-update-worker.ts',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        AUTO_UPDATE_ENABLED: 'true'
      },
      error_file: './logs/auto-update-error.log',
      out_file: './logs/auto-update-out.log',
      log_file: './logs/auto-update-combined.log',
      time: true,
      max_memory_restart: '300M',
      restart_delay: 5000,
      max_restarts: 5,
      autorestart: false // Solo si AUTO_UPDATE_ENABLED=true
    }
  ],

  // Configuración de despliegue (opcional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'tu-servidor.com',
      ref: 'origin/main',
      repo: 'git@github.com:tu-usuario/profebot.git',
      path: '/var/www/profebot',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'StrictHostKeyChecking=no'
    }
  }
};