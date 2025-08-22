# 📋 Requisitos para Despliegue en Producción - Dashboard UTEL

## 🚨 ADVERTENCIAS CRÍTICAS DE SEGURIDAD

### ⚠️ CREDENCIALES EXPUESTAS EN .env.local
**ACCIÓN INMEDIATA REQUERIDA:**
1. **API Key de OpenAI expuesta** - Debe ser regenerada INMEDIATAMENTE
2. **Token de Moodle expuesto** - Debe ser regenerado y actualizado
3. **NextAuth Secret en texto plano** - Debe ser regenerado

## 🔧 Requisitos de Infraestructura

### 1. Servidor de Aplicación
- **Node.js**: v18+ LTS
- **RAM**: Mínimo 2GB, recomendado 4GB
- **CPU**: 2+ cores
- **Almacenamiento**: 20GB mínimo

### 2. Base de Datos PostgreSQL
- **Versión**: PostgreSQL 14+
- **RAM**: 1GB mínimo
- **Almacenamiento**: 10GB inicial con capacidad de crecimiento
- **Conexiones**: Pool de mínimo 20 conexiones
- **Backup**: Sistema de respaldo automático diario

### 3. Redis Cache
- **Versión**: Redis 6.0+
- **RAM**: 512MB mínimo
- **Persistencia**: AOF habilitado
- **Configuración**: maxmemory-policy allkeys-lru

### 4. Servicios Externos Requeridos
- **OpenAI API**: Cuenta con créditos suficientes (~$0.05 USD por análisis)
- **Moodle**: Instancia con Web Services habilitados
- **SMTP** (opcional): Para notificaciones por email

## 🛡️ Configuración de Seguridad

### Variables de Entorno para Producción
```env
# Database - Usar conexión SSL
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# NextAuth - Generar nuevo secret
NEXTAUTH_URL="https://tu-dominio.com"
NEXTAUTH_SECRET="[GENERAR CON: openssl rand -base64 32]"

# Redis - Con autenticación
REDIS_URL="redis://:password@host:6379"

# APIs - Nuevas credenciales
MOODLE_API_TOKEN="[REGENERAR EN MOODLE]"
OPENAI_API_KEY="[NUEVA API KEY]"
```

### Medidas de Seguridad Requeridas
1. **HTTPS obligatorio** con certificado SSL válido
2. **Rate limiting** en endpoints de API
3. **CORS configurado** correctamente
4. **Headers de seguridad** (CSP, X-Frame-Options, etc.)
5. **Secrets management** con servicios como AWS Secrets Manager o HashiCorp Vault
6. **Logs seguros** sin exposición de datos sensibles

## 🚀 Proceso de Despliegue

### Opción A: Despliegue en Vercel (Recomendado)
```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Configurar proyecto
vercel

# 3. Configurar variables de entorno en Vercel Dashboard

# 4. Desplegar
vercel --prod
```

### Opción B: Despliegue en VPS/Cloud
```bash
# 1. Clonar repositorio
git clone [repo]

# 2. Instalar dependencias
npm ci --production

# 3. Build de producción
npm run build

# 4. Migraciones de base de datos
npm run db:migrate:prod

# 5. Iniciar con PM2
pm2 start npm --name "utel-dashboard" -- start
pm2 start npm --name "utel-worker" -- run worker
```

### Opción C: Docker (Requiere Dockerfile)
```dockerfile
# Dockerfile necesario (no existe actualmente)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Monitoreo y Observabilidad

### Herramientas Recomendadas
1. **APM**: New Relic, DataDog o Sentry
2. **Logs**: CloudWatch, Loggly o ELK Stack
3. **Uptime**: UptimeRobot o Pingdom
4. **Métricas**: Grafana + Prometheus

### Métricas Clave a Monitorear
- Tiempo de respuesta de API
- Tasa de errores
- Uso de CPU/RAM
- Queries lentas en PostgreSQL
- Cola de trabajos en Redis
- Costos de API de OpenAI

## 🔄 CI/CD Pipeline

### GitHub Actions (Recomendado)
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run deploy
```

## 📝 Checklist Pre-Producción

### Código
- [ ] Eliminar todos los console.log de debug
- [ ] Desactivar modo debug en Next.js
- [ ] Optimizar imágenes y assets
- [ ] Habilitar compresión gzip/brotli
- [ ] Configurar cache headers apropiados

### Base de Datos
- [ ] Crear índices necesarios
- [ ] Configurar connection pooling
- [ ] Establecer política de respaldos
- [ ] Configurar réplicas de lectura (opcional)

### Seguridad
- [ ] Regenerar TODAS las API keys
- [ ] Configurar firewall/security groups
- [ ] Implementar rate limiting
- [ ] Auditoría de dependencias (`npm audit`)
- [ ] Configurar WAF (Web Application Firewall)

### Performance
- [ ] CDN para assets estáticos
- [ ] Lazy loading de componentes
- [ ] Optimización de bundle size
- [ ] Configurar auto-scaling (si aplica)

## 🆘 Plan de Contingencia

### Rollback Strategy
1. Mantener versión anterior disponible
2. Database migrations reversibles
3. Feature flags para cambios críticos
4. Blue-green deployment

### Disaster Recovery
1. Backups automáticos cada 6 horas
2. Replicación multi-región (opcional)
3. Runbook de recuperación documentado
4. Tiempo objetivo de recuperación (RTO): < 4 horas

## 📚 Documentación Adicional Necesaria

1. **Manual de Operaciones**: Procedimientos de mantenimiento
2. **API Documentation**: Swagger/OpenAPI spec
3. **Runbook**: Guía de resolución de problemas comunes
4. **SLA Definition**: Niveles de servicio comprometidos

## 🎯 Estimación de Costos Mensuales

### Infraestructura Básica
- **Servidor (2GB RAM)**: $20-40 USD
- **PostgreSQL Managed**: $15-25 USD
- **Redis Managed**: $10-15 USD
- **Total Base**: ~$45-80 USD/mes

### Servicios Externos
- **OpenAI API**: Variable (~$50-200 USD según uso)
- **Dominio + SSL**: $10-15 USD/año
- **Monitoreo**: $0-50 USD (hay opciones gratuitas)

### Total Estimado: $100-300 USD/mes

## ⚡ Acciones Inmediatas Requeridas

1. **CRÍTICO**: Regenerar y asegurar todas las credenciales
2. **IMPORTANTE**: Crear Dockerfile para containerización
3. **IMPORTANTE**: Implementar sistema de secrets management
4. **RECOMENDADO**: Configurar pipeline CI/CD
5. **RECOMENDADO**: Implementar monitoreo básico

---

**Nota**: Este documento debe ser revisado y actualizado regularmente conforme el proyecto evoluciona.

**Última actualización**: Agosto 22, 2025