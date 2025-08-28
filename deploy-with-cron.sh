#!/bin/bash
# Script para desplegar la aplicación con PM2 y cron jobs habilitados

echo "🚀 Desplegando Teacher Dashboard con cron jobs..."

# Crear directorio de logs si no existe
mkdir -p logs

# Verificar que el build esté actualizado
echo "🔧 Verificando build..."
if [ ! -d ".next" ]; then
    echo "📦 Generando build de producción..."
    npm run build
fi

# Detener procesos previos
echo "🛑 Deteniendo procesos existentes..."
pm2 delete profebot-app 2>/dev/null || true

# Iniciar aplicación con configuración PM2
echo "▶️ Iniciando aplicación..."
pm2 start ecosystem.config.js --only profebot-app

# Esperar un momento para que se inicialice
sleep 3

# Verificar logs para confirmar que el cron está activo
echo "🔍 Verificando inicialización de cron jobs..."
pm2 logs profebot-app --lines 20 | grep -E "(CRON|cron|Programador|8:00 AM|6:00 PM)" || echo "⚠️ No se detectaron mensajes de cron en los logs iniciales"

echo ""
echo "✅ Despliegue completado!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Monitoreo: pm2 monit"
echo "📋 Ver logs: pm2 logs profebot-app"
echo "🔄 Reiniciar: pm2 restart profebot-app"
echo "🛑 Detener: pm2 delete profebot-app"
echo "🌐 Admin cron: http://localhost:3000/admin/cron"
echo ""
echo "⏰ Cron jobs programados:"
echo "   • 8:00 AM - Actualización matutina"
echo "   • 6:00 PM - Actualización vespertina"
echo "   • 2:00 AM - Limpieza de caché"
echo "   • Cada hora - Health check"