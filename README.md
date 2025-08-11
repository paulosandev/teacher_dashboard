# Sistema de Análisis Académico con IA

Dashboard para profesores que transforma datos de Moodle en insights accionables mediante análisis con IA.

## 🚀 Stack Tecnológico

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Base de Datos**: PostgreSQL con Prisma ORM
- **Sistema de Colas**: Redis + BullMQ
- **Autenticación**: NextAuth.js
- **IA**: Claude Sonnet API
- **Iconos**: Font Awesome

## 📋 Requisitos Previos

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- Cuenta de Anthropic (para Claude API)
- Acceso a API de Moodle

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone [tu-repo]
cd app-dashboard
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env.local
# Editar .env.local con tus credenciales
```

4. **Configurar la base de datos**
```bash
# Generar cliente de Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev
```

5. **Iniciar Redis**
```bash
# En macOS con Homebrew
brew services start redis

# O manualmente
redis-server
```

6. **Iniciar el servidor de desarrollo**
```bash
npm run dev
```

7. **Iniciar el worker (en otra terminal)**
```bash
npm run worker
```

## 🏗️ Arquitectura

### Flujo de Datos

1. **Autenticación**: Profesores inician sesión con usuario/contraseña/matrícula
2. **Scheduler**: Cron job ejecuta cada 4 horas para actualizar análisis
3. **Cola de Trabajos**: Redis/BullMQ gestiona los trabajos de análisis
4. **Worker**: Procesa trabajos en segundo plano:
   - Extrae datos de Moodle API
   - Envía a Claude para análisis
   - Guarda resultados en PostgreSQL
5. **Dashboard**: Muestra resultados pre-procesados instantáneamente

### Estructura del Proyecto

```
app-dashboard/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── dashboard/         # Páginas del dashboard
│   └── auth/              # Páginas de autenticación
├── components/            # Componentes React
│   ├── ui/               # Componentes UI reutilizables
│   └── dashboard/        # Componentes específicos del dashboard
├── lib/                   # Utilidades y configuraciones
│   ├── auth/            # Configuración de NextAuth
│   ├── db/              # Cliente de Prisma
│   ├── queue/           # Configuración de Redis/BullMQ
│   ├── moodle/          # Cliente API de Moodle
│   └── llm/             # Cliente API de Claude
├── prisma/               # Esquema y migraciones
├── types/                # Definiciones de TypeScript
├── utils/                # Funciones de utilidad
└── workers/              # Scripts de workers
```

## 📊 Modelo de Datos

### Tablas Principales

- **User**: Profesores del sistema
- **Course**: Cursos sincronizados desde Moodle
- **Group**: Grupos dentro de los cursos
- **Activity**: Actividades (tareas, exámenes, etc.)
- **Forum**: Foros de discusión
- **AnalysisResult**: Resultados del análisis con IA
- **JobLog**: Registro de trabajos procesados

## 🔧 Scripts Disponibles

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run start      # Servidor de producción
npm run worker     # Iniciar worker de procesamiento
npm run scheduler  # Iniciar scheduler manual
npm run lint       # Ejecutar linter
```

## 🚦 Estado del Proyecto

### Fase 1: Fundación y Autenticación
- [x] Setup del Proyecto
- [ ] Diseño y Setup de DB
- [ ] Implementación de Login
- [ ] Gestión de Sesión

### Fase 2: Lógica de Análisis y Workers
- [ ] Setup de Background Jobs
- [ ] Creación del Worker
- [ ] Cliente de Moodle
- [ ] Cliente del LLM
- [ ] Servicio de Análisis

### Fase 3: Integración y Cargas Periódicas
- [ ] API para Servir Datos
- [ ] Setup del Scheduler

### Fase 4: Desarrollo del Frontend
- [ ] Layout del Dashboard
- [ ] Componente Tarjeta de Análisis
- [ ] Conexión de Datos
- [ ] Manejo de Estados de UI

### Fase 5: Pruebas y Despliegue
- [ ] Pruebas Integrales
- [ ] Dockerización
- [ ] Despliegue Inicial

## 📝 Notas de Desarrollo

- El sistema procesa análisis de forma asíncrona para optimizar la experiencia del usuario
- Solo se muestran actividades y foros abiertos (no cerrados)
- Cada análisis se realiza por curso individual
- Los resultados se cachean en PostgreSQL para respuestas instantáneas

## 🤝 Contribución

[Agregar guías de contribución cuando sea relevante]

## 📄 Licencia

[Especificar licencia]
