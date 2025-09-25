# Scripts de Producción - Sistema Batch

Scripts para manejo del sistema batch de análisis en producción.

## 📋 Scripts Disponibles

### 1. **cleanup-production.js** - Limpieza Completa
Limpia completamente la base de datos, caché Redis y reinicia el estado del sistema.

```bash
# Ver qué se va a limpiar (modo seguro)
node scripts/cleanup-production.js

# Ejecutar limpieza completa
node scripts/cleanup-production.js --confirm
```

**⚠️ IMPORTANTE**: Este script elimina TODOS los datos del sistema.

#### Acciones que realiza:
- ✅ Eliminar todos los análisis de actividades (`activityAnalysis`)
- ✅ Eliminar todos los jobs batch (`batchJob`)
- ✅ Limpiar análisis batch legacy (`batchAnalysis`)
- ✅ Resetear flags de análisis en actividades
- ✅ Resetear estadísticas de aulas
- ✅ Limpiar caché Redis (si está configurado)

### 2. **run-batch-manual.js** - Ejecución Manual del Cron
Ejecuta el sistema batch manualmente con diferentes modos de operación.

```bash
# Ejecutar todas las aulas (prioridad aula 101)
node scripts/run-batch-manual.js

# Ejecutar SOLO aula 101
node scripts/run-batch-manual.js --aula101-only

# Forzar ejecución aunque haya jobs corriendo
node scripts/run-batch-manual.js --force
```

#### Modos de ejecución:

**🎯 Solo Aula 101** (`--aula101-only`)
- Procesa únicamente las actividades del aula 101
- Más rápido para pruebas y prioridad

**🌐 Todas las Aulas** (por defecto)
- Ejecuta aula 101 PRIMERO (prioridad)
- Luego ejecuta el cron completo para todas las aulas
- Proceso completo de producción

## 🚀 Flujo Recomendado para Producción

### Reinicio Completo del Sistema:
```bash
# 1. Limpiar sistema completo
node scripts/cleanup-production.js --confirm

# 2. Ejecutar batch completo con prioridad 101
node scripts/run-batch-manual.js
```

### Solo Procesar Aula 101:
```bash
# Procesar únicamente aula 101 (para pruebas o prioridad)
node scripts/run-batch-manual.js --aula101-only
```

### Forzar Ejecución:
```bash
# Si hay jobs bloqueados, forzar nueva ejecución
node scripts/run-batch-manual.js --force
```

## 🔧 Variables de Entorno Requeridas

Asegurar que estas variables estén configuradas en producción:

```bash
# Base de datos
DATABASE_URL="postgresql://..."

# OpenAI
OPENAI_API_KEY="sk-..."

# Redis (opcional)
REDIS_URL="redis://..."
# O
UPSTASH_REDIS_REST_URL="https://..."

# URL de la aplicación (para llamadas API)
NEXTAUTH_URL="https://tu-dominio.com"
# O
VERCEL_URL="tu-app.vercel.app"
```

## 📊 Monitoreo

### Ver Estadísticas:
Los scripts muestran estadísticas completas al finalizar:
- Total de análisis generados
- Análisis por aula
- Duración de procesamiento
- Errores encontrados

### Verificar Estado:
```bash
# Ver último job ejecutado
curl https://tu-dominio.com/api/batch/status

# Ver estadísticas actuales
curl https://tu-dominio.com/api/batch/sync-and-analyze
```

## ⚠️ Consideraciones de Producción

1. **Verificación Previa**: Los scripts verifican jobs activos antes de ejecutar
2. **Logs Detallados**: Todos los scripts generan logs completos
3. **Manejo de Errores**: Fallos controlados con códigos de salida apropiados
4. **Interrupción Segura**: `Ctrl+C` cierra conexiones limpiamente
5. **Timeouts**: Jobs que corren más de 30min se marcan como fallidos

## 🔐 Seguridad

- Scripts diseñados específicamente para producción
- Confirmación requerida para acciones destructivas
- Logs sin información sensible
- Conexiones de BD con pooling optimizado

## 📝 Logs de Ejemplo

```
🚀 EJECUCIÓN MANUAL DEL CRON BATCH - PRODUCCIÓN
=======================================================
🌐 MODO: Todas las aulas (prioridad Aula 101)
🔍 Verificando jobs activos...
🎯 PASO 1: Procesando Aula 101 (PRIORIDAD)...
✅ Aula 101 completada:
   • 15/18 análisis
   • 0 errores
   • 45s
🌐 PASO 2: Ejecutando cron completo (todas las aulas)...
✅ Cron completo ejecutado:
   • Job ID: 1234
   • Aulas: 12
   • Cursos: 145
   • Actividades: 289
   • Análisis: 156
   • Duración: 124s

📊 ESTADÍSTICAS FINALES
-------------------------
📈 Total de análisis: 1,247
🕐 Análisis últimas 24h: 156
🏫 Por aula:
   • Aula 101: 89 análisis
   • Aula 102: 67 análisis
   • Aula 103: 54 análisis

✅ PROCESO BATCH COMPLETADO EXITOSAMENTE
⏱️  Duración total: 169s
```