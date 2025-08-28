# 🔧 Correcciones Pendientes y Recomendaciones

## 🚨 CORRECCIONES CRÍTICAS (URGENTE)

### 1. ❌ Problema: Matricula undefined en sesión
**Síntomas:**
- La matrícula del usuario aparece como `undefined` en varios componentes
- Afecta la obtención de cursos correctos desde Moodle
- Causa que se muestren cursos incorrectos o ninguno

**Solución Propuesta:**
```typescript
// En app/api/auth/[...nextauth]/auth-options.ts
callbacks: {
  async session({ session, token }) {
    // Asegurar que matricula se incluya en la sesión
    const user = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { matricula: true, email: true, name: true }
    });
    
    session.user = {
      ...session.user,
      id: token.sub,
      matricula: user?.matricula || '',
      email: user?.email || ''
    };
    
    return session;
  }
}
```

**Archivos a modificar:**
- `app/api/auth/[...nextauth]/auth-options.ts`
- `types/next-auth.d.ts` (actualizar tipos)
- `components/dashboard/dashboard-content.tsx`

---

### 2. ❌ Problema: getGroupMembers deshabilitado
**Síntomas:**
- No se pueden obtener miembros de grupos específicos
- Análisis incompletos sin datos de estudiantes
- Mensajes de "Sin estudiantes" cuando sí los hay

**Solución Propuesta:**
```typescript
// Implementar método alternativo usando core_enrol_get_enrolled_users
async getGroupMembers(courseId: number, groupId: number) {
  try {
    // Primero obtener todos los usuarios del curso
    const enrolledUsers = await this.makeRequest('core_enrol_get_enrolled_users', {
      courseid: courseId
    });
    
    // Luego filtrar por grupo usando core_group_get_group_members
    const groupMembers = await this.makeRequest('core_group_get_group_members', {
      groupids: [groupId]
    });
    
    // Combinar información
    return enrolledUsers.filter(user => 
      groupMembers[0]?.userids?.includes(user.id)
    );
  } catch (error) {
    // Fallback: obtener usuarios del curso con rol estudiante
    return this.getCourseStudents(courseId);
  }
}
```

**Archivos a modificar:**
- `lib/moodle/smart-client.ts`
- `lib/moodle/api-client.ts`

---

### 3. ❌ Problema: Token muestra usuario incorrecto
**Síntomas:**
- Token de cesar.espindola muestra como marco.arce en Moodle
- Inconsistencia entre usuario logueado y token usado
- Posible reutilización de tokens entre usuarios

**Solución Propuesta:**
```typescript
// Limpiar y regenerar tokens por usuario
async function cleanupAndRegenerateTokens() {
  // 1. Eliminar todos los tokens existentes
  await prisma.userMoodleToken.deleteMany();
  
  // 2. Forzar regeneración en próximo login
  // En auth-service.ts
  async authenticateWithCredentials(username, password) {
    // Siempre generar nuevo token, no reutilizar
    const token = await this.getMoodleToken(username, password);
    
    // Verificar que el token corresponda al usuario correcto
    const userInfo = await this.getUserInfo(token);
    if (userInfo.username !== username) {
      throw new Error('Token mismatch detected');
    }
    
    return { token, userInfo };
  }
}
```

**Archivos a modificar:**
- `lib/moodle/auth-service.ts`
- `scripts/cleanup-tokens.ts` (crear nuevo)

---

### 4. ❌ Problema: IDs de grupo no coinciden
**Síntomas:**
- Grupos seleccionados no existen en Moodle
- Mapeo incorrecto entre IDs locales y Moodle
- Análisis fallan por grupo no encontrado

**Solución Propuesta:**
```typescript
// Implementar validación y mapeo robusto
interface GroupMapping {
  localId: number;
  moodleId: number;
  courseMoodleId: number;
  validated: boolean;
}

async function validateAndMapGroups(courseId: number) {
  // Obtener grupos desde Moodle
  const moodleGroups = await moodleClient.getCourseGroups(courseId);
  
  // Obtener grupos locales
  const localGroups = await prisma.group.findMany({
    where: { courseId }
  });
  
  // Crear mapeo validado
  const mapping = [];
  for (const local of localGroups) {
    const moodle = moodleGroups.find(g => 
      g.name === local.name || g.id === local.moodleId
    );
    
    if (moodle) {
      mapping.push({
        localId: local.id,
        moodleId: moodle.id,
        validated: true
      });
      
      // Actualizar BD con ID correcto
      await prisma.group.update({
        where: { id: local.id },
        data: { moodleId: moodle.id }
      });
    }
  }
  
  return mapping;
}
```

**Archivos a modificar:**
- `lib/services/group-mapping.service.ts` (crear nuevo)
- `app/api/moodle/sync/route.ts` (crear endpoint de sincronización)

---

## ⚠️ MEJORAS IMPORTANTES (1-2 SEMANAS)

### 5. 🔄 Sistema de Logs Estructurado
**Objetivo:** Trazabilidad completa de operaciones

**Implementación:**
```typescript
// Sistema de logs centralizado
class LogService {
  async log(level: 'info' | 'warn' | 'error', context: {
    userId?: string;
    action: string;
    details: any;
    timestamp: Date;
  }) {
    // Guardar en BD
    await prisma.systemLog.create({
      data: {
        level,
        userId: context.userId,
        action: context.action,
        details: JSON.stringify(context.details),
        timestamp: context.timestamp
      }
    });
    
    // También escribir a archivo
    if (process.env.NODE_ENV === 'production') {
      await this.writeToFile(level, context);
    }
  }
}
```

**Beneficios:**
- Debugging más fácil
- Auditoría completa
- Detección de patrones de error

---

### 6. 📊 Estados Vacíos Mejorados
**Objetivo:** UX clara cuando no hay datos

**Implementación:**
```tsx
// Componente de estado vacío reutilizable
function EmptyState({ 
  type: 'no-courses' | 'no-analysis' | 'no-students',
  onAction?: () => void 
}) {
  const configs = {
    'no-courses': {
      icon: BookOpen,
      title: 'No tienes cursos asignados',
      description: 'Contacta al administrador para que te asigne cursos',
      action: 'Solicitar acceso'
    },
    'no-analysis': {
      icon: ChartBar,
      title: 'Sin análisis disponibles',
      description: 'Genera tu primer análisis para obtener insights',
      action: 'Generar análisis'
    },
    'no-students': {
      icon: Users,
      title: 'Sin estudiantes inscritos',
      description: 'Los estudiantes aparecerán cuando se inscriban',
      action: null
    }
  };
  
  const config = configs[type];
  
  return (
    <Card className="p-8 text-center">
      <config.icon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-lg font-medium">{config.title}</h3>
      <p className="mt-1 text-sm text-gray-500">{config.description}</p>
      {config.action && onAction && (
        <Button onClick={onAction} className="mt-4">
          {config.action}
        </Button>
      )}
    </Card>
  );
}
```

---

### 7. 🔔 Sistema de Notificaciones
**Objetivo:** Feedback inmediato al usuario

**Implementación:**
```typescript
// Hook para notificaciones
function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  
  const notify = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);
    
    // Auto-dismiss después de 5 segundos
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };
  
  return { notifications, notify };
}

// Componente de notificaciones
function NotificationContainer({ notifications }) {
  return (
    <div className="fixed bottom-4 right-4 space-y-2">
      {notifications.map(n => (
        <Toast key={n.id} type={n.type}>
          {n.message}
        </Toast>
      ))}
    </div>
  );
}
```

---

## 💡 RECOMENDACIONES DE ARQUITECTURA

### 8. 🏗️ Implementar Queue System
**Por qué:** Procesamiento asíncrono de análisis pesados

**Tecnologías sugeridas:**
- BullMQ para manejo de colas
- Redis como backend
- Worker processes separados

**Ejemplo:**
```typescript
// Queue para análisis
const analysisQueue = new Queue('analysis', {
  connection: redis
});

// Worker procesador
const worker = new Worker('analysis', async job => {
  const { courseId, groupId, userId } = job.data;
  
  // Proceso pesado
  const analysis = await generateAnalysis(courseId, groupId);
  
  // Notificar al usuario
  await notifyUser(userId, 'Análisis completado');
  
  return analysis;
});
```

---

### 9. 🗄️ Implementar Cache Strategy
**Por qué:** Reducir llamadas a APIs externas

**Implementación:**
```typescript
class CacheService {
  private redis: Redis;
  
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set<T>(key: string, value: T, ttl = 3600) {
    await this.redis.setex(
      key, 
      ttl, 
      JSON.stringify(value)
    );
  }
  
  // Cache con invalidación inteligente
  async getCourseData(courseId: number) {
    const key = `course:${courseId}`;
    let data = await this.get(key);
    
    if (!data) {
      data = await moodleClient.getCourse(courseId);
      await this.set(key, data, 1800); // 30 min
    }
    
    return data;
  }
}
```

---

### 10. 🔒 Mejorar Seguridad
**Implementaciones necesarias:**

```typescript
// 1. Rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de requests
});

// 2. Validación de inputs
import { z } from 'zod';

const analysisSchema = z.object({
  courseId: z.number().positive(),
  groupId: z.number().positive().optional(),
  type: z.enum(['full', 'quick', 'forum'])
});

// 3. Sanitización de outputs
function sanitizeAnalysis(analysis: any) {
  // Remover datos sensibles
  delete analysis.rawData;
  delete analysis.internalNotes;
  return analysis;
}
```

---

## 📈 OPTIMIZACIONES DE PERFORMANCE

### 11. 🚀 Lazy Loading y Code Splitting
```typescript
// Cargar componentes pesados solo cuando se necesiten
const AnalysisChart = dynamic(
  () => import('@/components/charts/analysis-chart'),
  { 
    loading: () => <Skeleton />,
    ssr: false 
  }
);

// Dividir bundles por ruta
export default function Dashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardContent />
    </Suspense>
  );
}
```

### 12. ⚡ Optimización de Queries
```typescript
// Usar select para traer solo campos necesarios
const courses = await prisma.course.findMany({
  where: { teacherId: userId },
  select: {
    id: true,
    name: true,
    moodleId: true,
    // NO traer campos pesados como description
  }
});

// Paginación para listas largas
const analyses = await prisma.analysis.findMany({
  where: { courseId },
  take: 10,
  skip: page * 10,
  orderBy: { createdAt: 'desc' }
});
```

---

## 🧪 TESTING STRATEGY

### 13. Tests Críticos a Implementar
```typescript
// 1. Test de autenticación
describe('Authentication', () => {
  it('should create session with matricula', async () => {
    const session = await auth({ 
      email: 'test@test.com', 
      password: 'test' 
    });
    expect(session.user.matricula).toBeDefined();
  });
});

// 2. Test de permisos
describe('Permissions', () => {
  it('should only show teacher courses', async () => {
    const courses = await getCourses(teacherUserId);
    courses.forEach(course => {
      expect(course.teacherId).toBe(teacherUserId);
    });
  });
});

// 3. Test de integración Moodle
describe('Moodle Integration', () => {
  it('should handle API errors gracefully', async () => {
    // Mock API failure
    jest.spyOn(moodleClient, 'getCourses').mockRejectedValue(
      new Error('API Error')
    );
    
    const result = await fetchCourses();
    expect(result.error).toBeDefined();
    expect(result.courses).toEqual([]);
  });
});
```

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN

### Semana 1 (Crítico)
- [ ] Fix matricula undefined
- [ ] Fix getGroupMembers
- [ ] Limpiar tokens incorrectos
- [ ] Validar mapeo de IDs
- [ ] Implementar logs básicos

### Semana 2 (Importante)
- [ ] Estados vacíos mejorados
- [ ] Sistema de notificaciones
- [ ] Cache básico
- [ ] Tests de autenticación

### Semana 3-4 (Optimización)
- [ ] Queue system
- [ ] Rate limiting
- [ ] Lazy loading
- [ ] Tests completos
- [ ] Documentación API

### Mes 2 (Escalabilidad)
- [ ] Migrar a microservicios
- [ ] Implementar webhooks
- [ ] Analytics dashboard
- [ ] A/B testing framework

---

## 🎯 MÉTRICAS DE ÉXITO POST-CORRECCIONES

### Técnicas
- ✅ 0 errores de matricula undefined
- ✅ 100% grupos con miembros correctos
- ✅ Tokens únicos por usuario
- ✅ < 1% errores en producción

### UX
- ✅ Estados vacíos informativos
- ✅ Notificaciones claras
- ✅ Tiempo de respuesta < 2s
- ✅ 0 estados confusos

### Negocio
- ✅ +50% satisfacción usuarios
- ✅ -80% tickets de soporte
- ✅ +100% análisis generados
- ✅ 95% profesores activos semanalmente

---

## 🚦 PRIORIZACIÓN FINAL

### 🔴 Hacer YA (0-3 días)
1. Fix matricula undefined
2. Limpiar tokens
3. Logs de debugging

### 🟡 Hacer PRONTO (1 semana)
4. Fix getGroupMembers
5. Mapeo IDs correcto
6. Estados vacíos

### 🟢 Hacer DESPUÉS (2-4 semanas)
7. Notificaciones
8. Cache
9. Tests
10. Optimizaciones

---

*Documento creado: 14 de Agosto 2025*
*Próxima revisión: 21 de Agosto 2025*
*Responsable: Equipo de Desarrollo*
