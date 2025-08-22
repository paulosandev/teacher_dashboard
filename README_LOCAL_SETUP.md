# 🚀 Guía de Configuración Local - Dashboard UTEL

## Instrucciones para Configurar el Proyecto Localmente

### Requisitos Previos

- **Node.js 18+** instalado
- **PostgreSQL 14+** instalado localmente o Docker
- **Redis** instalado localmente o Docker
- **Git** para clonar el repositorio

### Opción A: Setup Manual (Sin Docker)

#### 1. Clonar el Repositorio

```bash
git clone [URL_DEL_REPOSITORIO]
cd app-dashboard
```

#### 2. Instalar Dependencias

```bash
npm install
```

#### 3. Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env.local

# Editar .env.local con tus valores locales
```

Configurar en `.env.local`:
```env
# Database - Ajustar con tu configuración local
DATABASE_URL="postgresql://tu_usuario@localhost:5432/academic_analysis?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="desarrollo-local-secret-key-123456"

# Redis
REDIS_URL="redis://localhost:6379"

# Moodle API (usar credenciales de prueba)
MOODLE_API_URL="https://av141.utel.edu.mx/webservice/rest/server.php"
MOODLE_API_TOKEN="token_de_prueba"

# OpenAI (usar tu propia API key o solicitar una de prueba)
OPENAI_API_KEY="sk-tu-api-key-de-prueba"
```

#### 4. Configurar Base de Datos

```bash
# Generar cliente de Prisma
npm run db:generate

# Crear las tablas en la base de datos
npm run db:push

# (Opcional) Poblar con datos de prueba
npm run db:seed
```

#### 5. Iniciar Redis

```bash
# En macOS con Homebrew
brew services start redis

# En Linux
sudo systemctl start redis

# O manualmente
redis-server
```

#### 6. Iniciar la Aplicación

```bash
# Terminal 1: Iniciar Next.js
npm run dev

# Terminal 2: Iniciar el worker (opcional)
npm run worker:dev
```

La aplicación estará disponible en: http://localhost:3000

### Opción B: Setup con Docker (Más Fácil)

#### 1. Clonar el Repositorio

```bash
git clone [URL_DEL_REPOSITORIO]
cd app-dashboard
```

#### 2. Crear archivo .env

```bash
# Copiar el ejemplo
cp .env.example .env

# Editar con tus API keys
nano .env
```

#### 3. Iniciar con Docker Compose

```bash
# Construir e iniciar todos los servicios
docker-compose up --build

# O en segundo plano
docker-compose up -d --build
```

Esto iniciará:
- PostgreSQL en puerto 5432
- Redis en puerto 6379
- Next.js app en puerto 3000
- Worker de análisis

#### 4. Ejecutar Migraciones

```bash
# En una nueva terminal
docker-compose exec app npm run db:push
```

### 🧪 Verificar la Instalación

1. **Verificar que todo esté funcionando:**
```bash
npm run check
```

2. **Probar conexión con Moodle:**
```bash
npm run test:moodle
```

3. **Acceder a la aplicación:**
- Abrir navegador en http://localhost:3000
- Deberías ver la página de login

### 📝 Credenciales de Prueba

Para testing local, puedes usar:
- **Usuario**: profesor@test.com
- **Password**: test123
- **Matrícula**: TEST001

### 🐛 Solución de Problemas Comunes

#### Error: "Cannot connect to PostgreSQL"
```bash
# Verificar que PostgreSQL esté corriendo
psql -U postgres -c "SELECT 1"

# Crear la base de datos si no existe
createdb academic_analysis
```

#### Error: "Redis connection refused"
```bash
# Verificar que Redis esté corriendo
redis-cli ping
# Debe responder: PONG
```

#### Error: "Cannot find module '@prisma/client'"
```bash
# Regenerar Prisma Client
npm run db:generate
```

#### Error con las migraciones
```bash
# Reset completo de la base de datos
npm run db:reset
```

### 🔧 Scripts Útiles

```bash
# Desarrollo
npm run dev           # Iniciar en modo desarrollo
npm run worker:dev    # Iniciar worker con hot-reload

# Base de Datos
npm run db:studio     # Abrir Prisma Studio (GUI para la DB)
npm run db:reset      # Reset completo de la base de datos

# Testing
npm run test:moodle   # Probar conexión con Moodle
npm run check         # Verificar configuración

# Producción
npm run build         # Build de producción
npm run start         # Iniciar en modo producción
```

### 📁 Estructura del Proyecto

```
app-dashboard/
├── app/              # Next.js App Router
├── components/       # Componentes React
├── lib/             # Utilidades y configuraciones
├── prisma/          # Esquema de base de datos
├── workers/         # Workers de procesamiento
├── docker-compose.yml # Para setup con Docker
└── package.json     # Dependencias y scripts
```

### 🤝 Contacto para Soporte

Si tienes problemas con la configuración:
1. Revisar los logs: `npm run dev` muestra errores detallados
2. Verificar las variables de entorno estén correctas
3. Asegurarse que PostgreSQL y Redis estén corriendo

### ⚠️ Notas Importantes

- **NO commitear** archivos `.env` o `.env.local` con credenciales reales
- Las API keys de ejemplo no funcionarán, necesitas obtener las tuyas
- El worker es opcional para desarrollo, pero necesario para análisis automáticos
- Prisma Studio (`npm run db:studio`) es útil para ver/editar datos

---

**¡Listo para desarrollar!** 🎉

Una vez configurado, el flujo de trabajo es:
1. Hacer cambios en el código
2. El servidor se recarga automáticamente
3. Probar en http://localhost:3000