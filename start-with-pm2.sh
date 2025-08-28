#!/bin/bash
# Script para iniciar la aplicación con PM2 y cron habilitado

echo "🚀 Iniciando aplicación con PM2 y cron jobs..."

# Detener procesos previos si existen
pm2 delete teacher-dashboard 2>/dev/null || true

# Iniciar con variable de entorno para habilitar cron
pm2 start npm --name "teacher-dashboard" -- start --env ENABLE_CRON=true

# Mostrar logs
pm2 logs teacher-dashboard --lines 10

echo "✅ Aplicación iniciada con cron jobs habilitados"
echo "📊 Puedes monitorear con: pm2 monit"
echo "📋 Ver logs: pm2 logs teacher-dashboard"