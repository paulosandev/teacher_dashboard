# 🚂 Guía de Despliegue en Railway - Dashboard UTEL

## ✅ Por qué Railway es Ideal para tu Proyecto

Railway soporta **TODOS** los componentes de tu aplicación:
- ✅ Next.js application
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ Background workers (BullMQ)
- ✅ Cron jobs
- ✅ Variables de entorno seguras
- ✅ SSL automático

## 💰 Costos Estimados

### Plan Hobby ($5/mes)
- **500 horas de ejecución** incluidas
- **$10 en créditos** mensuales
- **Recursos**: Suficiente para tu aplicación completa

### Recursos típicos necesarios:
- App principal: ~$3-5/mes
- Worker: ~$2-3/mes
- PostgreSQL: ~$5/mes
- Redis: ~$5/mes
**Total estimado: $15-20/mes**

## 🚀 Opción 1: Despliegue Rápido desde GitHub (Recomendado)

### Paso 1: Preparar el Repositorio

```bash
# Asegúrate de que todos los archivos estén commiteados
git add .
git commit -m "Preparar para despliegue en Railway"
git push origin main
```

### Paso 2: Crear Cuenta en Railway
1. Ir a [railway.app](https://railway.app)
2. Registrarse con GitHub
3. Autorizar Railway para acceder a tus repositorios

### Paso 3: Crear Nuevo Proyecto

1. Click en **"New Project"**
2. Seleccionar **"Deploy from GitHub repo"**
3. Elegir tu repositorio `app-dashboard`
4. Railway detectará automáticamente que es una app Next.js

### Paso 4: Agregar PostgreSQL

1. En tu proyecto, click **"+ New"**
2. Seleccionar **"Database"** → **"Add PostgreSQL"**
3. Railway creará automáticamente la variable `DATABASE_URL`

### Paso 5: Agregar Redis

1. Click **"+ New"** nuevamente
2. Seleccionar **"Database"** → **"Add Redis"**
3. Railway creará la variable `REDIS_URL`

### Paso 6: Configurar Variables de Entorno

1. Click en tu servicio principal
2. Ir a **"Variables"**
3. Agregar las siguientes variables:

```env
# NextAuth (GENERAR NUEVAS)
NEXTAUTH_URL=https://tu-app.up.railway.app
NEXTAUTH_SECRET=[Generar con: openssl rand -base64 32]

# Moodle API (USAR CREDENCIALES SEGURAS)
MOODLE_API_URL=https://av141.utel.edu.mx/webservice/rest/server.php
MOODLE_API_TOKEN=[REGENERAR EN MOODLE]

# OpenAI (CREAR NUEVA API KEY)
OPENAI_API_KEY=[NUEVA API KEY]

# Node
NODE_ENV=production
```

### Paso 7: Agregar Worker como Servicio Separado

1. Click **"+ New"** → **"Empty Service"**
2. Nombrar como "worker"
3. En Settings del worker:
   - **Source**: Same repo
   - **Root Directory**: /
   - **Build Command**: `npm ci && npx prisma generate`
   - **Start Command**: `npm run worker`
4. Copiar las mismas variables de entorno

### Paso 8: Ejecutar Migraciones

```bash
# Opción A: Desde Railway CLI
railway run npm run db:migrate:prod

# Opción B: Agregar como script de deploy
# En railway.json, agregar:
"deploy": {
  "startCommand": "npm run db:migrate:prod && npm start"
}
```

## 🛠️ Opción 2: Despliegue con Railway CLI

### Instalación y Setup

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear nuevo proyecto
railway init
```

### Configurar Servicios

```bash
# Agregar PostgreSQL
railway add --plugin postgresql

# Agregar Redis
railway add --plugin redis

# Ver variables generadas
railway variables
```

### Configurar Variables de Entorno

```bash
# Agregar variables una por una
railway variables set NEXTAUTH_SECRET="$(openssl rand -base64 32)"
railway variables set NEXTAUTH_URL="https://tu-app.up.railway.app"
railway variables set MOODLE_API_TOKEN="tu-token-seguro"
railway variables set MOODLE_API_URL="https://av141.utel.edu.mx/webservice/rest/server.php"
railway variables set OPENAI_API_KEY="tu-nueva-api-key"
```

### Desplegar

```bash
# Desplegar aplicación principal
railway up

# Ver logs
railway logs

# Abrir en navegador
railway open
```

## 🔧 Configuración Avanzada

### Configurar Dominio Personalizado

1. En Railway Dashboard → Settings → Domains
2. Click **"+ Add Domain"**
3. Agregar tu dominio: `dashboard.tudominio.com`
4. Configurar DNS:
   ```
   CNAME dashboard.tudominio.com → tu-app.up.railway.app
   ```

### Configurar Health Checks

Ya está configurado en:
- `railway.json` - Define el endpoint
- `/api/health/route.ts` - Implementa el check

### Configurar Auto-scaling (Pro Plan)

```json
// railway.json
{
  "deploy": {
    "numReplicas": {
      "min": 1,
      "max": 3
    }
  }
}
```

## 📊 Monitoreo y Logs

### Ver Logs en Tiempo Real
```bash
# CLI
railway logs --tail

# O en Dashboard
# Click en servicio → "View Logs"
```

### Métricas
- Railway Dashboard muestra:
  - CPU usage
  - Memory usage
  - Network I/O
  - Response times

### Alertas (Pro Plan)
- Configurar webhooks para Discord/Slack
- Alertas por uso excesivo de recursos

## 🚨 Troubleshooting

### Error: "Cannot find module '@prisma/client'"
**Solución**: Asegurar que el build command incluya:
```bash
npx prisma generate && npm run build
```

### Error: "Database connection failed"
**Solución**: Verificar que `DATABASE_URL` incluya:
```
?schema=public&connection_limit=5
```

### Worker no se ejecuta
**Solución**: Crear servicio separado con start command:
```bash
npm run worker
```

### Build falla por memoria
**Solución**: Agregar en railway.json:
```json
{
  "build": {
    "buildCommand": "NODE_OPTIONS='--max-old-space-size=4096' npm run build"
  }
}
```

## 🔒 Checklist de Seguridad Pre-Despliegue

- [ ] **Regenerar TODAS las API keys**
- [ ] **Crear nuevo NEXTAUTH_SECRET**
- [ ] **Verificar que .env.local NO esté en git**
- [ ] **Configurar CORS apropiadamente**
- [ ] **Habilitar 2FA en Railway**
- [ ] **Configurar backups de base de datos**

## 📝 Scripts Útiles para package.json

```json
{
  "scripts": {
    "deploy": "railway up",
    "deploy:prod": "railway up --environment production",
    "logs": "railway logs --tail",
    "db:migrate:railway": "railway run npm run db:migrate:prod",
    "railway:shell": "railway shell"
  }
}
```

## 🎯 Comandos Rápidos Post-Despliegue

```bash
# Ver estado de servicios
railway status

# Ejecutar migraciones
railway run npm run db:migrate:prod

# Reiniciar servicio
railway restart

# Ver variables de entorno
railway variables

# Conectar a base de datos
railway connect postgresql
```

## 📈 Optimizaciones para Producción

1. **Configurar CDN para assets**
   - Railway soporta Cloudflare integration

2. **Optimizar imágenes**
   ```bash
   npm install --save-dev @next/bundle-analyzer
   ```

3. **Habilitar ISR (Incremental Static Regeneration)**
   ```typescript
   export const revalidate = 3600 // 1 hora
   ```

## 🆘 Soporte

- **Documentación**: [docs.railway.app](https://docs.railway.app)
- **Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Status**: [status.railway.app](https://status.railway.app)

---

## ⚡ Acción Inmediata

1. **CRÍTICO**: Regenerar todas las credenciales antes de desplegar
2. **Commitear** todos los archivos nuevos:
   ```bash
   git add .
   git commit -m "Agregar configuración para Railway"
   git push
   ```
3. **Crear cuenta** en Railway.app
4. **Seguir** Opción 1 para despliegue rápido

**Tiempo estimado de despliegue: 15-20 minutos**

---

**Última actualización**: Agosto 22, 2025