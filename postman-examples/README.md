# Postman Examples - Profebot Dashboard API

## Descripción
Este directorio contiene colecciones de Postman para probar los endpoints del dashboard de Profebot.

## Archivo Principal
- `Group-Activities-API.postman_collection.json` - Colección completa para el endpoint de actividades de grupo

## Cómo usar

### 1. Importar en Postman
1. Abre Postman
2. Haz clic en "Import"
3. Selecciona el archivo `Group-Activities-API.postman_collection.json`
4. La colección aparecerá en tu workspace

### 2. Configurar Autenticación
**IMPORTANTE**: Este endpoint requiere autenticación NextAuth. Necesitas obtener las cookies de sesión:

1. Abre el dashboard en tu navegador
2. Inicia sesión con tus credenciales Moodle
3. Abre las herramientas de desarrollador (F12)
4. Ve a la pestaña "Application" o "Storage"
5. En "Cookies", busca:
   - `next-auth.session-token`
   - `next-auth.csrf-token`
6. Copia estos valores y actualiza las variables de entorno en Postman

### 3. Variables de Entorno
La colección incluye estas variables configurables:

- `base_url`: URL base del servidor (default: `http://localhost:3000`)
- `course_id`: ID del curso en Moodle (ejemplo: `237`)
- `group_id`: ID del grupo (uso `0` para acceso general)
- `aula_url`: URL del aula específica (ejemplo: `https://av141.utel.edu.mx`)
- `session_token`: Token de sesión NextAuth
- `csrf_token`: Token CSRF NextAuth

### 4. Endpoint Principal

#### GET /api/group/activities

**Parámetros de Query:**
- `courseId` (requerido): ID del curso en Moodle
- `groupId` (opcional): ID del grupo (0 para acceso general)
- `aulaUrl` (opcional): URL del aula específica

**Ejemplo de Llamada:**
```
GET http://localhost:3000/api/group/activities?courseId=237&groupId=0&aulaUrl=https://av141.utel.edu.mx
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "courseId": "237",
  "groupId": "0",
  "activities": [
    {
      "id": 1234,
      "name": "Foro de Presentación",
      "modname": "forum_discussion",
      "type": "Foro",
      "hasAnalysis": true,
      "analysis": {
        "summary": "El foro muestra una participación activa...",
        "insights": ["Participación elevada..."],
        "recommendations": ["Continuar fomentando..."],
        "alerts": []
      }
    }
  ],
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## Casos de Prueba Incluidos

### 1. Éxito - Actividades con Análisis
- **Escenario**: Curso con actividades que tienen análisis pre-calculados
- **Resultado**: Lista de actividades con campo `hasAnalysis: true` y objeto `analysis` completo

### 2. Éxito - Sin Actividades
- **Escenario**: Curso sin actividades o actividades sin análisis
- **Resultado**: Array vacío de actividades

### 3. Error - courseId Faltante
- **Escenario**: Request sin parámetro courseId
- **Resultado**: HTTP 400 con mensaje de error

### 4. Error - Sin Autenticación
- **Escenario**: Request sin cookies de sesión válidas
- **Resultado**: HTTP 401 "No hay sesión activa"

## Notas Técnicas

### Arquitectura del Sistema
- **Cron/Batch**: Motor de análisis que genera análisis pre-calculados
- **Dashboard**: Visor de resultados que consulta análisis existentes
- **Base de Datos**: Prisma con PostgreSQL almacena análisis en tabla `ActivityAnalysis`

### Formato de CourseId en BD
Los análisis se almacenan con formato `{aulaId}-{courseId}`:
- Ejemplo: `av141-237` para curso 237 de aula av141

### Campos Importantes de Respuesta
- `hasAnalysis`: Indica si la actividad tiene análisis pre-calculado
- `analysis`: Objeto con análisis completo (solo si `hasAnalysis: true`)
- `analysis.lastUpdated`: Timestamp de la última actualización del análisis
- `analysis.analysisId`: ID único del análisis en la base de datos

## Solución de Problemas

### Error: "No hay sesión activa"
- Verifica que las cookies de NextAuth sean válidas y recientes
- Asegúrate de que el servidor esté ejecutándose en el puerto correcto

### Error: "courseId es requerido"
- Incluye el parámetro `courseId` en la query string
- Verifica que el valor sea un número válido

### Actividades sin análisis
- Las actividades aparecerán con `hasAnalysis: false`
- Ejecuta el proceso batch de sincronización para generar análisis
- Verifica que el curso tenga actividades del tipo compatible (forum, assign)

## Comandos Útiles

### Ejecutar Sincronización Manual
```bash
curl -X POST "http://localhost:3000/api/batch/sync-and-analyze" -H "Content-Type: application/json"
```

### Verificar Base de Datos
```bash
npx prisma studio
```

### Ver Logs del Servidor
```bash
npm run dev
```