# 🏗️ Contexto General del Proyecto - Dashboard Análisis Moodle

## 📝 Descripción del Proyecto

### Visión General
Dashboard inteligente que integra la plataforma educativa Moodle con análisis potenciados por Inteligencia Artificial (OpenAI GPT-4) para proporcionar insights detallados y accionables a profesores universitarios sobre el desempeño de sus cursos, participación estudiantil y áreas de mejora.

### Problema que Resuelve
Los profesores actualmente dedican horas analizando manualmente datos dispersos en Moodle para entender el progreso de sus estudiantes. Este dashboard automatiza ese proceso, generando análisis profundos en segundos y proporcionando recomendaciones específicas basadas en IA.

### Usuarios Objetivo
- **Primarios:** Profesores universitarios de UTEL
- **Secundarios:** Coordinadores académicos y administradores
- **Beneficiarios finales:** Estudiantes (mediante mejor seguimiento)

---

## 🏛️ ARQUITECTURA DEL SISTEMA

### Arquitectura General
```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  Next.js 14 (App Router) + React 18 + TypeScript            │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  Dashboard  │ │  Componentes │ │    Hooks     │        │
│  │   Pages     │ │      UI      │ │   Custom     │        │
│  └─────────────┘ └──────────────┘ └──────────────┘        │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/REST
┌───────────────────────▼─────────────────────────────────────┐
│                     API LAYER                                │
│                 Next.js API Routes                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │    Auth      │ │   Analysis   │ │    Moodle    │       │
│  │  Endpoints   │ │  Generation  │ │  Integration │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                   BUSINESS LOGIC                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │   Services   │ │   Clients    │ │  Processors  │       │
│  │  (Auth, AI)  │ │   (Moodle)   │ │   (Data)     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└────────┬──────────────┬──────────────┬─────────────────────┘
         │              │              │
┌────────▼───────┐ ┌───▼────┐ ┌──────▼──────┐
│   PostgreSQL   │ │ Moodle │ │   OpenAI    │
│   + Prisma     │ │  API   │ │   GPT-4     │
└────────────────┘ └────────┘ └─────────────┘
```

### Flujo de Datos Principal
1. **Autenticación:** Usuario → NextAuth → PostgreSQL → Sesión JWT
2. **Obtención de Datos:** Dashboard → API Routes → Moodle Client → Moodle API
3. **Generación de Análisis:** Datos Moodle → Procesador → OpenAI → Análisis Estructurado
4. **Visualización:** Análisis → React Components → UI Interactiva

### Patrones de Diseño Implementados
- **MVC:** Separación clara entre Vista (React), Controlador (API Routes) y Modelo (Prisma)
- **Repository Pattern:** Capa de abstracción para acceso a datos
- **Service Layer:** Lógica de negocio encapsulada en servicios
- **Factory Pattern:** Para crear diferentes tipos de clientes Moodle
- **Strategy Pattern:** Para diferentes estrategias de análisis (IA vs Heurística)

---

## 💻 STACK TECNOLÓGICO

### Frontend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Next.js** | 14.2.x | Framework React con SSR y API Routes |
| **React** | 18.3.x | Librería UI componentes |
| **TypeScript** | 5.6.x | Tipado estático y mejor DX |
| **Tailwind CSS** | 3.4.x | Estilos utility-first |
| **Radix UI** | Latest | Componentes accesibles primitivos |
| **Lucide React** | 0.460.x | Iconos SVG optimizados |
| **React Hook Form** | 7.x | Manejo de formularios |
| **Recharts** | 2.x | Gráficos y visualizaciones |

### Backend
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Node.js** | 20.x LTS | Runtime JavaScript |
| **Prisma** | 6.1.x | ORM type-safe |
| **PostgreSQL** | 15.x | Base de datos relacional |
| **NextAuth.js** | 4.24.x | Autenticación y sesiones |
| **bcryptjs** | 2.4.x | Hashing de contraseñas |
| **jsonwebtoken** | 9.x | Tokens JWT |

### Integraciones Externas
| Servicio | Versión | Propósito |
|----------|---------|-----------|
| **Moodle API** | 4.x | Plataforma educativa fuente de datos |
| **OpenAI API** | GPT-4 | Análisis inteligente con IA |
| **Axios** | 1.7.x | Cliente HTTP para APIs |

### Herramientas de Desarrollo
| Herramienta | Propósito |
|-------------|-----------|
| **ESLint** | Linting y calidad de código |
| **Prettier** | Formateo consistente |
| **TypeScript Compiler** | Compilación y type-checking |
| **Vercel CLI** | Deployment y preview |
| **Git** | Control de versiones |

---

## 📁 ESTRUCTURA DEL PROYECTO

```
app-dashboard/
├── app/                        # Next.js App Router
│   ├── api/                   # API Routes
│   │   ├── auth/             # Autenticación endpoints
│   │   ├── analysis/         # Generación de análisis
│   │   ├── moodle/          # Integración Moodle
│   │   └── user/            # Gestión usuarios
│   ├── dashboard/            # Páginas del dashboard
│   │   ├── v2/              # Nueva versión mejorada
│   │   └── settings/        # Configuración usuario
│   └── (auth)/              # Páginas autenticación
│
├── components/                # Componentes React
│   ├── dashboard/           # Componentes específicos
│   │   ├── analysis-card.tsx
│   │   ├── course-selector.tsx
│   │   └── forum-metrics.tsx
│   └── ui/                  # Componentes UI base
│       ├── button.tsx
│       ├── card.tsx
│       └── badge.tsx
│
├── lib/                      # Librerías y utilidades
│   ├── moodle/              # Cliente y servicios Moodle
│   │   ├── api-client.ts   # Cliente básico
│   │   ├── smart-client.ts # Cliente inteligente
│   │   └── auth-service.ts # Autenticación Moodle
│   ├── db/                  # Configuración BD
│   │   └── prisma.ts       # Cliente Prisma
│   └── utils/               # Utilidades generales
│
├── prisma/                   # Esquema y migraciones
│   ├── schema.prisma        # Modelos de datos
│   └── migrations/          # Historial migraciones
│
├── public/                   # Assets estáticos
├── styles/                   # Estilos globales
└── contexto_proyecto/        # Documentación proyecto
```

---

## 🔐 SEGURIDAD Y AUTENTICACIÓN

### Sistema de Autenticación Híbrido
1. **Local:** Credenciales almacenadas en PostgreSQL con bcrypt
2. **Moodle:** Token API obtenido con credenciales Moodle
3. **Sesiones:** JWT con NextAuth, httpOnly cookies

### Medidas de Seguridad
- **Encriptación:** Contraseñas con bcrypt, tokens con AES-256
- **CORS:** Configurado para dominios permitidos
- **Rate Limiting:** En endpoints críticos
- **Validación:** Input sanitization en todos los endpoints
- **HTTPS:** Obligatorio en producción
- **CSP:** Content Security Policy configurado
- **Secrets:** Variables de entorno, nunca en código

### Permisos y Roles
- **Profesor:** Acceso a sus cursos y estudiantes
- **Admin:** Acceso total al sistema
- **Estudiante:** Sin acceso (futuro: vista limitada)

---

## 🔄 FLUJOS PRINCIPALES

### 1. Login y Autenticación
```
Usuario ingresa credenciales
    ↓
NextAuth valida en BD local
    ↓
Si es profesor, obtiene token Moodle
    ↓
Crea sesión JWT
    ↓
Redirige a dashboard
```

### 2. Generación de Análisis
```
Profesor selecciona curso/grupo
    ↓
Sistema obtiene datos de Moodle
    ↓
Procesa y estructura información
    ↓
Envía a OpenAI con prompt
    ↓
Recibe y parsea respuesta
    ↓
Guarda en BD
    ↓
Muestra en UI
```

### 3. Visualización de Datos
```
Dashboard carga
    ↓
Fetch cursos del profesor
    ↓
Usuario selecciona curso
    ↓
Carga análisis existentes
    ↓
Renderiza cards y métricas
    ↓
Actualización en tiempo real
```

---

## 🎯 CARACTERÍSTICAS PRINCIPALES

### Implementadas ✅
1. **Autenticación completa** con NextAuth
2. **Integración Moodle** bidireccional
3. **Análisis con IA** usando GPT-4
4. **Dashboard interactivo** con React
5. **Selector de cursos** dinámico
6. **Métricas de foros** detalladas
7. **Identificación estudiantes en riesgo**
8. **Recomendaciones personalizadas**
9. **Sistema de tokens** por usuario
10. **Logs y auditoría** básica

### En Desarrollo ⚠️
1. **Corrección de bugs** de sesión
2. **Mejoras UX** en estados vacíos
3. **Sistema de notificaciones**
4. **Exportación de reportes**

### Planificadas 📅
1. **Tests automatizados** completos
2. **Dashboard móvil** responsive
3. **Análisis predictivo** avanzado
4. **Integración con calendarios**
5. **API pública** para terceros

---

## 🚀 DEPLOYMENT Y ENTORNOS

### Entornos
| Ambiente | URL | Propósito |
|----------|-----|-----------|
| **Local** | localhost:3000 | Desarrollo |
| **Staging** | staging.dominio.com | Testing |
| **Production** | app.utel.edu.mx | Producción |

### Configuración de Entorno
```env
# Base de Datos
DATABASE_URL="postgresql://..."

# Autenticación
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."

# Moodle
MOODLE_API_URL="https://av141.utel.edu.mx"
MOODLE_API_TOKEN="..."

# OpenAI
OPENAI_API_KEY="sk-..."

# Encriptación
ENCRYPTION_KEY="..."
```

### CI/CD Pipeline
1. **Push a GitHub** → Trigger workflow
2. **Tests automáticos** → Jest + Playwright
3. **Build & Lint** → Next.js build
4. **Deploy Preview** → Vercel preview
5. **Aprobación manual** → Para producción
6. **Deploy Production** → Vercel production

---

## 📊 MÉTRICAS Y MONITOREO

### KPIs Técnicos
- **Performance:** LCP < 2.5s, FID < 100ms
- **Disponibilidad:** Uptime > 99.9%
- **Errores:** Error rate < 1%
- **API Latency:** P95 < 500ms

### KPIs de Negocio
- **Adopción:** 80% profesores activos
- **Engagement:** 3+ sesiones/semana
- **Satisfacción:** NPS > 40
- **Tiempo ahorrado:** 5h/semana por profesor

### Herramientas de Monitoreo
- **Vercel Analytics:** Performance y uso
- **Sentry:** Error tracking
- **LogRocket:** Session replay
- **Custom Dashboard:** Métricas específicas

---

## 🤝 EQUIPO Y COLABORACIÓN

### Estructura del Equipo
- **Product Owner:** Define requerimientos
- **Tech Lead:** Arquitectura y decisiones técnicas
- **Desarrolladores:** Implementación features
- **QA:** Testing y validación
- **DevOps:** Infrastructure y deployment

### Metodología
- **Scrum:** Sprints de 2 semanas
- **Daily Standups:** Sincronización diaria
- **Code Reviews:** PR obligatorios
- **Pair Programming:** Para features complejas

### Comunicación
- **Slack:** Comunicación diaria
- **Jira:** Tracking de tareas
- **Confluence:** Documentación
- **GitHub:** Código y revisiones

---

## 📚 RECURSOS Y DOCUMENTACIÓN

### Documentación Técnica
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Moodle API Docs](https://docs.moodle.org/dev/Web_service_API_functions)
- [OpenAI API Reference](https://platform.openai.com/docs)

### Guías Internas
- README.md - Setup inicial
- CONTRIBUTING.md - Guía de contribución
- API.md - Documentación endpoints
- DEPLOYMENT.md - Proceso de deploy

### Contactos Clave
- **Soporte Moodle:** soporte@utel.edu.mx
- **DevOps:** infraestructura@utel.edu.mx
- **Seguridad:** seguridad@utel.edu.mx

---

*Documento actualizado: 14 de Agosto 2025*
*Versión: 1.0.0*
