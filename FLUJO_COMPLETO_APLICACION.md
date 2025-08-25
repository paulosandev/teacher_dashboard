# 📊 Flujo Completo de la Aplicación Dashboard UTEL

## 🔐 **PASO 1: LOGIN Y AUTENTICACIÓN**

### Entrada del Usuario
1. Usuario ingresa:
   - Email
   - Password
   - Matrícula (campo adicional importante)

### Proceso de Autenticación
1. **NextAuth** valida credenciales contra la base de datos PostgreSQL
2. Busca el usuario en tabla `User` con email y password encriptado
3. **IMPORTANTE**: Guarda la matrícula en la sesión (esto es clave para Moodle)
4. Crea JWT token con datos del usuario
5. Redirige a `/dashboard`

---

## 🏠 **PASO 2: CARGA INICIAL DEL DASHBOARD**

### Carga del Server Component (`app/dashboard/page.tsx`)

1. **Verificación de Sesión**
   ```typescript
   const session = await getSession()
   if (!session) redirect('/auth/login')
   ```

2. **Carga de Datos del Usuario desde PostgreSQL**
   - Busca usuario en DB con `prisma.user.findUnique()`
   - Incluye sus cursos, grupos, actividades y foros
   - **PROBLEMA**: Inicialmente intenta cargar desde DB local (que puede estar vacía)

3. **Intenta Cargar Análisis Previos**
   - Busca en tabla `AnalysisResult` donde `isLatest = true`
   - Filtra por los cursos del usuario
   - Transforma datos para las tarjetas de análisis

4. **Renderiza el Dashboard**
   - Pasa datos al componente cliente `DashboardContent`

---

## 🔄 **PASO 3: CARGA DE DATOS DE MOODLE (Client Side)**

### Hook `useMoodleData` se Ejecuta Automáticamente

1. **Test de Conexión**
   ```
   GET /api/moodle?action=test
   ```
   - Verifica que puede conectar con Moodle
   - Usa el token del usuario (si existe) o token admin

2. **Obtención de Cursos**
   ```
   GET /api/moodle?action=courses
   ```
   - **FLUJO INTERNO**:
     a. Crea `MoodleAPIClientEnhanced` con ID y email del usuario
     b. Busca token de Moodle en tabla `User` (campo `moodleToken`)
     c. Si no hay token, usa token admin de variables de entorno
     d. Llama a Moodle API: `core_enrol_get_users_courses`
     e. Obtiene lista de cursos donde el usuario es profesor
     f. Para cada curso, obtiene grupos: `core_group_get_course_groups`

3. **Respuesta con Estructura**:
   ```json
   {
     "id": "123",
     "name": "Matemáticas Avanzadas",
     "shortName": "MAT-ADV",
     "groups": [
       {"id": "456", "name": "Grupo A"},
       {"id": "789", "name": "Grupo B"}
     ]
   }
   ```

---

## 🎯 **PASO 4: SELECCIÓN AUTOMÁTICA DEL PRIMER CURSO**

### useEffect en `dashboard-content.tsx`

```typescript
useEffect(() => {
  if (moodleCourses.length > 0 && !selectedCourse) {
    const firstCourse = moodleCourses[0];
    const firstGroup = firstCourse.groups[0];
    setSelectedCourse(firstCourse.id);
    setSelectedGroup(firstGroup.id);
    // Dispara la carga después de 100ms
    setTimeout(() => {
      handleSelectionChange(firstCourse.id, firstGroup.id);
    }, 100);
  }
}, [moodleCourses]);
```

**ESTO ES LO QUE VES**: El select toma automáticamente la primera opción y empieza a cargar.

---

## 📊 **PASO 5: PROCESO DE CARGA DE ANÁLISIS**

### Función `handleSelectionChange`

1. **Actualiza Estados**
   ```typescript
   setSelectedCourse(courseId)
   setSelectedGroup(groupId)
   ```

2. **Filtra Tarjetas Existentes**
   - Busca en `analysisCards` si hay análisis previos
   - Filtra por courseId y groupId

3. **Si NO hay análisis previos**:
   - Llama a `checkAndTriggerAnalysis(courseId, groupId)`

---

## 🤖 **PASO 6: GENERACIÓN DE ANÁLISIS CON IA**

### Función `checkAndTriggerAnalysis`

1. **Llamada al Endpoint**
   ```
   POST /api/analysis/generate-real
   Body: { courseId, groupId }
   ```

2. **Proceso en el Backend** (`generate-real/route.ts`):

   a. **Verificación de Permisos**
      - Confirma que el usuario es profesor del curso
      - Verifica que tiene matrícula registrada

   b. **Verificación de Contenido**
      ```typescript
      const courseContent = await checkCourseContent(courseId, moodleClient)
      ```
      - Obtiene foros: `mod_forum_get_forums_by_courses`
      - Obtiene contenido: `core_course_get_contents`
      - Si no hay contenido, retorna error

   c. **Recolección de Datos Detallados**
      ```typescript
      const analysisData = await collectDetailedCourseData(courseId, groupId, moodleClient)
      ```
      - **Obtiene**:
        * Información del curso
        * Lista de estudiantes del grupo
        * Actividades (tareas, cuestionarios, etc.)
        * Foros y discusiones
        * Posts y participación
        * Calificaciones

   d. **Generación con OpenAI**
      ```typescript
      const aiAnalysisResult = await generateAIAnalysisWithDetails(analysisData, courseId, analysisDetails)
      ```
      - **Construye prompt** con todos los datos
      - **Modelo**: `gpt-4o-mini` (o el configurado)
      - **Solicita**:
        * Resumen ejecutivo
        * Fortalezas identificadas
        * Alertas y problemas
        * Recomendaciones
        * Estudiantes en riesgo

   e. **Guardado en Base de Datos**
      - Guarda en tabla `AnalysisResult`
      - Marca como `isLatest = true`
      - Incluye respuesta completa del LLM

   f. **Generación de PDF**
      - Crea reporte técnico con todos los detalles
      - Guarda en carpeta `ReportDebug/`

3. **Respuesta al Frontend**
   ```json
   {
     "success": true,
     "analysis": {...},
     "details": {
       "requestId": "req_123456",
       "processingTime": 3240,
       "tokensUsed": 2500,
       "model": "gpt-4o-mini",
       "cost": 0.05
     }
   }
   ```

---

## 🔄 **PASO 7: ACTUALIZACIÓN DE LA INTERFAZ**

### Función `refreshAnalysisForCourse`

1. **Obtiene Análisis Actualizados**
   ```
   GET /api/analysis
   ```
   - Trae todos los análisis más recientes de la DB

2. **Filtra por Curso y Grupo Actual**
   - Compara IDs de Moodle
   - Actualiza `analysisCards` state

3. **Re-renderiza las Tarjetas**
   - Muestra las nuevas tarjetas de análisis
   - Cada tarjeta tiene:
     * Título de la actividad/foro
     * Fortalezas (verde)
     * Alertas (amarillo/rojo)
     * Siguiente paso recomendado
     * Botón "Ver más"

---

## 📈 **PASO 8: FLUJO CONTINUO**

### Cuando el Usuario Cambia de Curso/Grupo

1. **CourseSelector dispara onChange**
2. **Repite desde PASO 5**
3. **Si ya hay análisis en caché**: Los muestra inmediatamente
4. **Si no hay análisis**: Genera nuevos con IA

### Botón "Re-analizar"

1. **Vuelve a ejecutar** todo el PASO 6
2. **Sobrescribe** el análisis anterior
3. **Actualiza** las tarjetas en tiempo real

---

## 🔑 **PUNTOS CLAVE DEL FLUJO**

### Lo que funciona bien:
✅ Autenticación con matrícula
✅ Conexión con Moodle API
✅ Detección automática de cursos
✅ Generación de análisis con IA
✅ Guardado en base de datos

### Problemas identificados:
❌ **Selección automática del primer curso** (puede ser molesto)
❌ **Carga inicial desde DB vacía** (debería ir directo a Moodle)
❌ **Tiempo de espera** para generar análisis (~3-5 segundos)
❌ **No hay indicador de progreso** durante la generación

### Datos que se consultan en Moodle:
1. **Cursos del profesor** (`core_enrol_get_users_courses`)
2. **Grupos del curso** (`core_group_get_course_groups`)
3. **Foros** (`mod_forum_get_forums_by_courses`)
4. **Discusiones** (`mod_forum_get_forum_discussions`)
5. **Posts** (`mod_forum_get_discussion_posts`)
6. **Contenido del curso** (`core_course_get_contents`)
7. **Estudiantes** (`core_enrol_get_enrolled_users`)
8. **Calificaciones** (`gradereport_user_get_grade_items`)

### Procesamiento con IA:
- **Entrada**: ~2000-3000 tokens de datos de Moodle
- **Salida**: ~500-1000 tokens de análisis
- **Costo**: ~$0.02-0.05 USD por análisis
- **Tiempo**: 2-5 segundos

---

## 🎯 **RESUMEN DEL FLUJO**

1. **Login** → Guarda matrícula en sesión
2. **Dashboard carga** → Intenta DB local primero
3. **Hook Moodle** → Obtiene cursos reales del profesor
4. **Auto-selección** → Primer curso y grupo
5. **Busca análisis** → En DB local
6. **Si no hay** → Genera con IA (3-5 seg)
7. **Muestra tarjetas** → Con el análisis
8. **Usuario interactúa** → Cambia curso o re-analiza

Este es el flujo completo desde que el usuario hace login hasta que ve los análisis en pantalla.