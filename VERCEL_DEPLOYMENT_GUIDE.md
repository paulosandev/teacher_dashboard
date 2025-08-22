# 🚀 Guía de Despliegue en Vercel - Dashboard UTEL

## ⚠️ IMPORTANTE: Limitaciones de Vercel

### ❌ **Problema Principal: Redis y Workers**
Tu aplicación usa **BullMQ con Redis** para procesar trabajos en segundo plano (workers), pero **Vercel NO soporta procesos de larga duración ni workers**.

### Opciones para resolver esto:

#### Opción 1: **Usar Vercel + Servicio Externo para Workers** (Recomendado)
- Desplegar la app principal en Vercel
- Usar **Railway**, **Render** o **Fly.io** para ejecutar el worker
- Mantener Redis en **Upstash** o **Redis Cloud**

#### Opción 2: **Migrar a Vercel Cron Jobs**
- Reemplazar BullMQ por Vercel Cron Jobs
- Limitado a ejecuciones programadas (no en tiempo real)
- Máximo 60 segundos de ejecución

#### Opción 3: **Usar otra plataforma**
- **Railway**, **Render**, o **DigitalOcean App Platform** soportan workers nativamente

## 📋 Preparación para Vercel (Si eliges Opción 1)

### 1. **Instalar Vercel CLI**
```bash
npm i -g vercel
```

### 2. **Configurar Base de Datos PostgreSQL**

Opciones recomendadas:
- **Neon** (gratis, integrado con Vercel)
- **Supabase** (gratis hasta 500MB)
- **PlanetScale** (MySQL pero compatible con Prisma)

### 3. **Configurar Redis Externo**

Necesitas un servicio de Redis externo:
- **Upstash Redis** (integrado con Vercel, plan gratis disponible)
- **Redis Cloud** (plan gratis de 30MB)

### 4. **Preparar Variables de Entorno**

```bash
# En Vercel Dashboard o CLI, configurar:

DATABASE_URL="postgresql://[usuario]:[password]@[host]/[database]?sslmode=require"
NEXTAUTH_URL="https://tu-app.vercel.app"
NEXTAUTH_SECRET="[GENERAR NUEVO: openssl rand -base64 32]"
REDIS_URL="redis://default:[password]@[host]:[port]"
MOODLE_API_URL="https://av141.utel.edu.mx/webservice/rest/server.php"
MOODLE_API_TOKEN="[REGENERAR TOKEN EN MOODLE]"
OPENAI_API_KEY="[NUEVA API KEY DE OPENAI]"
```

### 5. **Modificar package.json**
```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

### 6. **Crear/Actualizar vercel.json**
```json
{
  "buildCommand": "prisma generate && next build",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/analysis/*/route.ts": {
      "maxDuration": 60
    }
  }
}
```

## 🔧 Proceso de Despliegue

### Paso 1: Conectar con GitHub
```bash
# En la raíz del proyecto
vercel

# Seguir los prompts:
# - Set up and deploy? Yes
# - Which scope? (tu cuenta)
# - Link to existing project? No
# - Project name? utel-dashboard
# - Directory? ./
# - Override settings? No
```

### Paso 2: Configurar Variables de Entorno
```bash
# Opción A: Desde CLI
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
# ... repetir para cada variable

# Opción B: Desde Dashboard
# Ir a: https://vercel.com/[tu-usuario]/[proyecto]/settings/environment-variables
```

### Paso 3: Desplegar
```bash
# Despliegue de producción
vercel --prod

# O hacer push a main si conectaste GitHub
git push origin main
```

## 🔄 Configurar Worker Externo (Railway)

Si mantienes BullMQ, necesitas desplegar el worker por separado:

### 1. Crear nuevo proyecto en Railway
```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Crear proyecto
railway init
```

### 2. Crear Dockerfile para Worker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
CMD ["npm", "run", "worker"]
```

### 3. Configurar variables en Railway
Usar las mismas variables de entorno que en Vercel

### 4. Desplegar
```bash
railway up
```

## 🔄 Alternativa: Migrar a Vercel Cron Jobs

Si prefieres eliminar Redis/BullMQ:

### 1. Crear API Route para Cron
```typescript
// app/api/cron/analysis/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: Request) {
  // Verificar autorización (solo Vercel puede llamar)
  const authHeader = headers().get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Tu lógica de análisis aquí
  // ...

  return NextResponse.json({ success: true })
}
```

### 2. Configurar en vercel.json
```json
{
  "crons": [
    {
      "path": "/api/cron/analysis",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

## ✅ Checklist Pre-Despliegue

- [ ] **Regenerar TODAS las API keys** (OpenAI, Moodle)
- [ ] **Crear nueva NEXTAUTH_SECRET**
- [ ] **Configurar base de datos PostgreSQL externa**
- [ ] **Configurar Redis externo (Upstash recomendado)**
- [ ] **Actualizar DATABASE_URL con SSL**
- [ ] **Verificar que .env.local NO esté en git**
- [ ] **Agregar postinstall script para Prisma**
- [ ] **Decidir estrategia para workers**

## 🚨 Problemas Comunes y Soluciones

### Error: "Cannot find module '@prisma/client'"
**Solución**: Agregar postinstall script
```json
"postinstall": "prisma generate"
```

### Error: "Connection timeout to database"
**Solución**: Verificar que DATABASE_URL incluya `?sslmode=require&connection_limit=1`

### Error: "NEXTAUTH_URL mismatch"
**Solución**: Asegurar que NEXTAUTH_URL sea exactamente tu dominio de Vercel

### Workers no funcionan
**Esperado**: Vercel no soporta workers. Usar servicio externo o migrar a cron jobs.

## 📊 Costos Estimados

### Vercel
- **Hobby**: Gratis (límites: 100GB bandwidth, 100hrs function execution)
- **Pro**: $20/mes (más límites, soporte)

### Base de Datos
- **Neon**: Gratis hasta 3GB
- **Supabase**: Gratis hasta 500MB

### Redis
- **Upstash**: Gratis hasta 10,000 comandos/día
- **Redis Cloud**: Gratis 30MB

### Worker (si usas Railway)
- **Railway**: $5/mes por servicio

**Total estimado**: $0-25/mes para comenzar

## 🎯 Recomendación Final

Para tu caso específico, recomiendo:

1. **Desplegar app principal en Vercel** (gratis)
2. **PostgreSQL en Neon** (gratis)
3. **Redis en Upstash** (gratis)
4. **Worker en Railway** ($5/mes) o migrar a Cron Jobs
5. **Regenerar TODAS las credenciales antes de desplegar**

---

**⚡ Acción Inmediata**: Regenera tus API keys ANTES de hacer cualquier despliegue público.