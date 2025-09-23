# API de Ejecución Manual del Proceso Batch

## Descripción
Este endpoint permite ejecutar manualmente el proceso de sincronización y análisis batch sin esperar al cron programado. Es útil para:
- Forzar actualizaciones inmediatas en producción
- Testing y debugging
- Recuperación después de fallos
- Procesar aulas específicas con prioridad

## Endpoint
```
POST /api/batch/trigger
GET  /api/batch/trigger  (para verificar estado)
```

## Autenticación
El endpoint está protegido mediante un secreto que debe configurarse en las variables de entorno:

```env
BATCH_SECRET=tu-secreto-seguro-aqui
```

El secreto puede enviarse de dos formas:
1. Como header: `x-batch-secret: tu-secreto`
2. Como query param: `?secret=tu-secreto`

## Uso

### 1. Verificar Estado Actual
```bash
curl "https://tu-dominio.com/api/batch/trigger?secret=tu-secreto"
```

Respuesta:
```json
{
  "success": true,
  "status": {
    "isUpdating": false,
    "lastUpdate": "2025-09-22T20:00:00.000Z",
    "nextScheduledUpdates": ["2025-09-23T00:00:00.000Z", "2025-09-23T14:00:00.000Z"]
  },
  "isUpdating": false,
  "timestamp": "2025-09-22T23:39:35.522Z"
}
```

### 2. Ejecutar Proceso Completo (Todas las Aulas)
```bash
curl -X POST "https://tu-dominio.com/api/batch/trigger" \
  -H "Content-Type: application/json" \
  -H "x-batch-secret: tu-secreto" \
  -d '{}'
```

### 3. Ejecutar Solo Análisis (Sin Sincronización)
```bash
curl -X POST "https://tu-dominio.com/api/batch/trigger" \
  -H "Content-Type: application/json" \
  -H "x-batch-secret: tu-secreto" \
  -d '{"onlyAnalysis": true}'
```

### 4. Procesar Aulas Específicas
```bash
curl -X POST "https://tu-dominio.com/api/batch/trigger" \
  -H "Content-Type: application/json" \
  -H "x-batch-secret: tu-secreto" \
  -d '{"aulaIds": ["101", "104", "av141"]}'
```

### 5. Forzar Re-análisis
```bash
curl -X POST "https://tu-dominio.com/api/batch/trigger" \
  -H "Content-Type: application/json" \
  -H "x-batch-secret: tu-secreto" \
  -d '{"forceAnalysis": true}'
```

## Parámetros del Body (POST)

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `aulaIds` | string[] | null | Array de IDs de aulas específicas. Si es null, procesa todas |
| `forceAnalysis` | boolean | false | Fuerza re-análisis aunque ya existan |
| `onlyAnalysis` | boolean | false | Solo ejecuta análisis, sin sincronización |
| `priority` | string | "normal" | Prioridad del proceso: "normal", "high", "low" |

## Ejemplos de Uso Combinados

### Análisis forzado solo para aula 101:
```bash
curl -X POST "https://tu-dominio.com/api/batch/trigger" \
  -H "Content-Type: application/json" \
  -H "x-batch-secret: tu-secreto" \
  -d '{
    "aulaIds": ["101"],
    "onlyAnalysis": true,
    "forceAnalysis": true
  }'
```

## Script de Utilidad
Existe un script bash para facilitar la ejecución:

```bash
# Configurar variables de entorno
export API_URL=https://tu-dominio.com
export BATCH_SECRET=tu-secreto

# Ejecutar script interactivo
./scripts/trigger-batch.sh
```

## Respuestas

### Éxito
```json
{
  "success": true,
  "message": "Proceso batch ejecutado exitosamente",
  "duration": "120.5s",
  "status": {
    "isUpdating": false,
    "lastUpdate": "2025-09-22T23:45:00.000Z",
    "processedAulas": 4,
    "processedCourses": 150,
    "generatedAnalyses": 450
  },
  "timestamp": "2025-09-22T23:45:00.000Z"
}
```

### Error - Proceso en Ejecución
```json
{
  "success": false,
  "error": "Ya hay un proceso batch en ejecución",
  "currentStatus": {
    "isUpdating": true,
    "startedAt": "2025-09-22T23:40:00.000Z"
  }
}
```

### Error - No Autorizado
```json
{
  "success": false,
  "error": "No autorizado"
}
```

## Notas de Seguridad

1. **Cambiar el secreto en producción**: El valor por defecto debe ser cambiado inmediatamente
2. **Limitar acceso**: Considerar agregar restricciones de IP si es posible
3. **Monitorear uso**: Los intentos no autorizados se registran en los logs
4. **Rate limiting**: Considerar implementar límites de tasa en producción

## Integración con CI/CD

El endpoint puede ser usado en pipelines de CI/CD para actualizar datos después de despliegues:

```yaml
# Ejemplo para GitHub Actions
- name: Trigger Batch Update
  run: |
    curl -X POST "${{ secrets.API_URL }}/api/batch/trigger" \
      -H "x-batch-secret: ${{ secrets.BATCH_SECRET }}" \
      -d '{"aulaIds": ["101"]}'
```

## Troubleshooting

### El proceso no inicia
- Verificar que no haya otro proceso en ejecución
- Revisar los logs del servidor
- Confirmar que el secreto es correcto

### Timeout en el request
- El proceso puede tomar varios minutos
- Considerar ejecutar con `onlyAnalysis: true` primero
- Procesar aulas específicas en lugar de todas

### Errores de memoria
- Procesar menos aulas a la vez
- Aumentar los recursos del servidor
- Usar el parámetro `priority: "low"` para reducir carga