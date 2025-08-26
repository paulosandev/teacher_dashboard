# Profebot Dashboard - Guía Rápida para DevOps

## 📦 Stack Tecnológico

- **Frontend/Backend**: Next.js 14.2.31 (React 18)
- **Base de Datos**: PostgreSQL v14+
- **Cache/Colas**: Redis v6+
- **ORM**: Prisma 6.13
- **Runtime**: Node.js v18.17+
- **Process Manager**: PM2 (recomendado)

## 🚀 Despliegue Rápido

### 1. Clonar y Preparar
```bash
git clone [repositorio]
cd app-dashboard
cp .env.example .env
# Editar .env con valores de producción
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Base de Datos
```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Build de Producción
```bash
npm run build
```

### 5. Iniciar Aplicación
```bash
# Con PM2 (recomendado)
pm2 start ecosystem.config.js

# O manualmente
npm start                          # App principal en puerto 3000
tsx workers/analysis-worker.ts     # Worker en proceso separado
```

## 🔧 Variables de Entorno Críticas

```env
# Base de Datos PostgreSQL
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Redis
REDIS_URL="redis://host:6379"

# Autenticación
NEXTAUTH_URL="https://dominio.com"
NEXTAUTH_SECRET="[generar con: openssl rand -base64 32]"

# OpenAI API
OPENAI_API_KEY="sk-..."

# Moodle
MOODLE_BASE_URL="https://moodle.institucion.edu"
```

Ver `.env.example` para lista completa con descripciones.

## 📁 Estructura de Archivos

```
app-dashboard/
├── app/              # Aplicación Next.js (App Router)
├── components/       # Componentes React
├── lib/             # Lógica de negocio
├── prisma/          # Esquema y migraciones
├── workers/         # Workers de procesamiento
├── public/          # Archivos estáticos
├── .env.example     # Variables de entorno de ejemplo
├── ecosystem.config.js  # Configuración PM2
└── package.json     # Dependencias y scripts
```

## 🔍 Verificación Pre-Despliegue

```bash
# Script de verificación rápida
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh
```

## 📊 Puertos y Servicios

| Servicio | Puerto Default | Configurable vía |
|----------|---------------|------------------|
| Next.js App | 3000 | `PORT` env var |
| PostgreSQL | 5432 | `DATABASE_URL` |
| Redis | 6379 | `REDIS_URL` |

## 🛠️ Scripts NPM Disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Build producción
npm start           # Iniciar producción
npm run db:migrate  # Migraciones
npm run db:seed     # Datos iniciales (opcional)
npm run worker      # Worker manual
```

## 🔄 Procesos del Sistema

1. **profebot-app**: Aplicación Next.js principal
2. **profebot-worker**: Procesador de análisis con IA
3. **profebot-auto-update**: (Opcional) Actualizador automático

## 📝 Logs

Con PM2:
```bash
pm2 logs            # Todos los logs
pm2 logs profebot-app     # Solo app
pm2 logs profebot-worker  # Solo worker
```

Los logs se guardan en `./logs/` si se usa PM2.

## ⚠️ Consideraciones de Seguridad

1. **NUNCA** commitear archivos `.env` con valores reales
2. Configurar HTTPS/SSL en producción
3. Usar un gestor de secretos para variables sensibles
4. Configurar firewall (solo puertos 80/443 públicos)
5. Rotar `NEXTAUTH_SECRET` y API keys regularmente

## 🏥 Health Check

```bash
# Endpoint de salud
curl http://localhost:3000/api/health
```

## 🔥 Troubleshooting Común

### Error de Conexión a DB
```bash
# Verificar PostgreSQL
psql $DATABASE_URL -c "SELECT 1"
```

### Error de Redis
```bash
# Verificar Redis
redis-cli ping
```

### Build Falla
```bash
# Limpiar cache y rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Worker No Procesa
```bash
# Verificar colas en Redis
redis-cli
> KEYS profebot:*
> LLEN profebot:analysis:queue
```

## 📞 Contacto para Soporte

Para dudas sobre la aplicación (no infraestructura):
- Revisar `DEPLOYMENT_GUIDE.md` para guía completa
- Consultar documentación en `/docs`
- Logs de aplicación para debugging

## ✅ Checklist Mínimo para Producción

- [ ] Variables de entorno configuradas en `.env`
- [ ] PostgreSQL accesible y con esquema migrado
- [ ] Redis accesible
- [ ] Build de Next.js completado sin errores
- [ ] PM2 o supervisor de procesos configurado
- [ ] Worker de análisis corriendo
- [ ] SSL/HTTPS configurado (proxy reverso)
- [ ] Backup de base de datos configurado

---

**Nota**: Esta es una guía rápida. Para detalles completos de configuración y mantenimiento, consultar `DEPLOYMENT_GUIDE.md`.