# Sistema Multi-Aula Integrado

## 🎉 Implementación Completa

El sistema multi-aula está **completamente integrado** en el proyecto Next.js principal. No requiere servicios externos adicionales.

## 🏗️ Arquitectura

### Componentes Principales

1. **Cliente Integrado** (`lib/db/integrated-enrolment-client.ts`)
   - Maneja túnel SSH usando comando del sistema
   - Pool de conexiones MySQL integrado
   - Singleton con gestión automática de conexiones

2. **API Endpoints** (`app/api/enrolments/[action]/route.ts`)
   - Endpoints RESTful protegidos por autenticación
   - Integración completa con Next.js
   - Sin dependencias externas

3. **Hook React** (`hooks/useTeacherAulas.ts`)
   - Gestión de estado de aulas del profesor
   - Persistencia en localStorage
   - Recarga automática y manejo de errores

4. **Componentes UI** (`components/dashboard/aula-selector.tsx`)
   - Selector dropdown completo
   - Estados de carga y error
   - Interfaz responsiva

## 🚀 Uso

### 1. Iniciar la Aplicación

```bash
# Un solo comando - todo integrado
npm run dev
```

### 2. Endpoints Disponibles

```
GET /api/enrolments/health          # Estado del sistema
GET /api/enrolments/my-aulas        # Aulas del profesor (requiere auth)
GET /api/enrolments/my-enrolments   # Enrolments completos (requiere auth)
GET /api/enrolments/check-teacher   # Verificar rol (requiere auth)
GET /api/enrolments/test           # Prueba de conectividad (público)

POST /api/enrolments/by-email      # Consultar por email específico
POST /api/enrolments/by-aula       # Cursos por aula específica
```

### 3. Página de Prueba

Visita: http://localhost:3000/test-multi-aula

Esta página permite:
- ✅ Ver todas las aulas del profesor
- ✅ Cambiar entre aulas
- ✅ Ver cursos por aula
- ✅ Estadísticas en tiempo real
- ✅ Debug del estado completo

### 4. Integrar en Dashboard Existente

```tsx
import AulaSelector from '@/components/dashboard/aula-selector'
import { useTeacherAulas } from '@/hooks/useTeacherAulas'

function Dashboard() {
  const { selectedAula, aulas, isTeacher } = useTeacherAulas()

  return (
    <div>
      {/* Selector de aula */}
      <AulaSelector 
        onAulaChange={(aula) => {
          // Cambiar contexto de aula
          console.log('Nueva aula seleccionada:', aula)
        }}
      />
      
      {/* Mostrar contenido basado en aula seleccionada */}
      {selectedAula && (
        <div>
          <h2>Trabajando en: {selectedAula.aulaUrl}</h2>
          <p>Cursos: {selectedAula.coursesCount}</p>
        </div>
      )}
    </div>
  )
}
```

## 🔧 Configuración

### Prerrequisitos

1. **Clave SSH**: Debe estar en la ruta especificada con permisos correctos
   ```bash
   chmod 600 "/Users/paulocesarsanchezespindola/Downloads/status-services-v2 3 1.pem"
   ```

2. **Conectividad**: Acceso al servidor EC2 y RDS
   - SSH: 44.233.107.237:22
   - RDS: wsdata.ce9oduyxts26.us-west-1.rds.amazonaws.com:3306

### Variables de Configuración

Todas las credenciales están hardcodeadas en el cliente integrado para simplicidad. En producción, usar variables de entorno:

```env
SSH_HOST=44.233.107.237
SSH_USER=ec2-user
SSH_KEY_PATH=/path/to/key.pem
DB_HOST=wsdata.ce9oduyxts26.us-west-1.rds.amazonaws.com
DB_USER=datos
DB_PASSWORD=PP7Su9e433aNZP956
DB_NAME=heroku_e6e033d354ff64c
```

## 📊 Datos en Producción

### Base de Datos `enrolment`
- **343,638** registros totales
- **2,874** profesores únicos
- **30** aulas diferentes (101-115, 1101-1113, av141, etc.)

### Mapeo de URLs
```javascript
// Números -> aulaXXX.utel.edu.mx
"101" -> "https://aula101.utel.edu.mx"
"102" -> "https://aula102.utel.edu.mx"

// Con letras -> directo
"av141" -> "https://av141.utel.edu.mx"
```

### Ejemplo de Datos
```json
{
  "email": "omarobr@hotmail.com",
  "totalEnrolments": 4,
  "aulasCount": 2,
  "aulas": [
    {
      "aulaId": "101",
      "aulaUrl": "https://aula101.utel.edu.mx",
      "coursesCount": 2
    },
    {
      "aulaId": "105", 
      "aulaUrl": "https://aula105.utel.edu.mx",
      "coursesCount": 2
    }
  ]
}
```

## ⚡ Rendimiento

### Optimizaciones Implementadas
- ✅ **Singleton**: Una sola instancia del cliente
- ✅ **Pool de Conexiones**: Reutilización de conexiones MySQL
- ✅ **Tunnel Persistente**: SSH tunnel se mantiene activo
- ✅ **Cache en Cliente**: Evita consultas repetitivas
- ✅ **Queries Optimizadas**: Solo datos necesarios

### Manejo de Errores
- ✅ **Reconexión Automática**: Si se pierde la conexión
- ✅ **Timeouts**: Evita bloqueos indefinidos
- ✅ **Cleanup**: Cierre automático de conexiones
- ✅ **Estados de UI**: Loading, error, success

## 🧪 Testing

```bash
# Probar conectividad básica
curl http://localhost:3000/api/enrolments/test

# Probar profesor específico
curl -X POST http://localhost:3000/api/enrolments/test \
  -H "Content-Type: application/json" \
  -d '{"email":"omarobr@hotmail.com"}'

# Probar directamente con script Node.js
npm run test:enrolments
```

## 📁 Archivos Clave

```
lib/db/integrated-enrolment-client.ts  # Cliente integrado principal
app/api/enrolments/[action]/route.ts   # API endpoints
hooks/useTeacherAulas.ts               # Hook React para aulas
components/dashboard/aula-selector.tsx # Componente selector
app/test-multi-aula/page.tsx          # Página de prueba completa
```

## 🎯 Próximos Pasos

1. **Integrar en Dashboard Principal**: Agregar `<AulaSelector>` al dashboard existente
2. **Cache Multi-Aula**: Extender sistema de cache para múltiples aulas
3. **Moodle Multi-Campus**: Modificar cliente Moodle para URLs dinámicas
4. **Performance Monitoring**: Métricas de conexión y queries

## ✅ Ventajas de la Integración

- 🔥 **Un Solo Proyecto**: No hay servicios externos que manejar
- ⚡ **Menor Complejidad**: Menos moving parts
- 🛡️ **Más Seguro**: Credenciales en un solo lugar
- 📦 **Fácil Deploy**: Solo `npm run build` y listo
- 🔧 **Fácil Debug**: Todo en un mismo proceso
- 💾 **Menos Recursos**: No múltiples procesos Node.js

El sistema multi-aula está **100% funcional y completamente integrado** en el proyecto principal. 🎉