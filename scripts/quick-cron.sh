#!/bin/bash

# Script rápido para comandos comunes del cron

case "$1" in
  "start" | "run" | "trigger")
    echo "🚀 Ejecutando análisis masivo..."
    npx tsx scripts/manual-cron.ts trigger
    ;;
  "test-101" | "aula-101" | "101")
    echo "🎯 Ejecutando análisis solo para Aula 101..."
    npx tsx scripts/manual-cron.ts test-101
    ;;
  "status" | "estado")
    echo "📊 Verificando estado del cron..."
    npx tsx scripts/manual-cron.ts status
    ;;
  "logs")
    echo "📋 Mostrando logs del cron..."
    npx tsx scripts/manual-cron.ts logs
    ;;
  "next" | "proximo")
    echo "⏰ Próxima ejecución programada..."
    npx tsx scripts/manual-cron.ts next
    ;;
  "monitor" | "watch")
    echo "🔄 Monitoreando progreso en tiempo real..."
    npx tsx scripts/manual-cron.ts monitor
    ;;
  "clear" | "clear-cache")
    echo "🧹 Limpiando caché..."
    npx tsx scripts/manual-cron.ts clear-cache
    ;;
  *)
    echo "📖 Comandos disponibles:"
    echo "  ./scripts/quick-cron.sh start       # Ejecutar análisis manualmente (todas las aulas)"
    echo "  ./scripts/quick-cron.sh test-101    # Ejecutar análisis SOLO para Aula 101"
    echo "  ./scripts/quick-cron.sh clear       # Limpiar caché para mostrar nuevos análisis"
    echo "  ./scripts/quick-cron.sh status      # Ver estado actual"
    echo "  ./scripts/quick-cron.sh logs        # Ver logs recientes"
    echo "  ./scripts/quick-cron.sh next        # Ver próxima ejecución"
    echo "  ./scripts/quick-cron.sh monitor     # Monitorear en tiempo real"
    echo ""
    echo "💡 Ejemplos rápidos:"
    echo "  npm run cron:start      # Usando npm scripts (todas las aulas)"
    echo "  npm run cron:test-101   # Solo Aula 101"
    echo "  npm run cron:clear      # Limpiar caché"
    echo "  npm run cron:status"
    echo "  npm run cron:monitor"
    ;;
esac