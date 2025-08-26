# Guía de Despliegue - Profebot Dashboard

## Requisitos del Sistema

### Software Requerido
- **Node.js** v18.17 o superior
- **PostgreSQL** v14 o superior
- **Redis** v6 o superior
- **npm** v9 o superior
- **PM2** (para gestión de procesos en producción)

### Recursos Mínimos
- **RAM**: 2GB mínimo (4GB recomendado)
- **CPU**: 2 cores mínimo
- **Almacenamiento**: 10GB disponible

## Preparación del Entorno

### 1. Clonar el Repositorio
```bash
git clone [tu-repositorio]
cd app-dashboard
git checkout main
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
```bash
cp .env.example .env
```

Editar `.env` con los valores correctos:

#### Variables Críticas
```env
# Base de Datos
DATABASE_URL="postgresql://usuario:password@localhost:5432/profebot_db"

# Redis
REDIS_URL="redis://localhost:6379"

# Autenticación
NEXTAUTH_URL="https://tu-dominio.com"
NEXTAUTH_SECRET="genera-con-openssl-rand-base64-32"

# OpenAI
OPENAI_API_KEY="sk-..."
OPENAI_ORG_ID="org-..." (opcional)

# Moodle
MOODLE_BASE_URL="https://moodle.tu-institucion.edu"
MOODLE_TOKEN="token-del-servicio" (opcional si usas auth por usuario)

# Aplicación
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://tu-dominio.com"
```

### 4. Configurar Base de Datos

#### Crear base de datos PostgreSQL
```bash
sudo -u postgres psql
CREATE DATABASE profebot_db;
CREATE USER profebot_user WITH ENCRYPTED PASSWORD 'tu-password-seguro';
GRANT ALL PRIVILEGES ON DATABASE profebot_db TO profebot_user;
\q
```

#### Ejecutar migraciones
```bash
npx prisma generate
npx prisma migrate deploy
```

#### (Opcional) Seed inicial
```bash
npm run db:seed
```

### 5. Configurar Redis

#### Instalar Redis (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

#### Verificar Redis
```bash
redis-cli ping
# Debe responder: PONG
```

## Build de Producción

### Compilar la Aplicación
```bash
npm run build
```

## Despliegue con PM2

### 1. Instalar PM2 Globalmente
```bash
npm install -g pm2
```

### 2. Iniciar Servicios
```bash
# Iniciar aplicación Next.js
pm2 start ecosystem.config.js --only app

# Iniciar worker de análisis
pm2 start ecosystem.config.js --only worker

# Guardar configuración
pm2 save
pm2 startup
```

### 3. Comandos Útiles de PM2
```bash
# Ver estado de procesos
pm2 status

# Ver logs
pm2 logs

# Reiniciar aplicación
pm2 restart app

# Detener todo
pm2 stop all

# Monitorear
pm2 monit
```

## Configuración de Nginx (Proxy Reverso)

### Instalar Nginx
```bash
sudo apt install nginx
```

### Configuración del Sitio
Crear archivo `/etc/nginx/sites-available/profebot`:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    # Redirección a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    # Certificados SSL (usa Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    # Configuración SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Tamaño máximo de subida
    client_max_body_size 10M;

    # Proxy a Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Timeout para análisis largos
    location /api/analysis {
        proxy_pass http://localhost:3000;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
    }
}
```

### Habilitar Sitio
```bash
sudo ln -s /etc/nginx/sites-available/profebot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL con Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

## Verificación del Despliegue

### 1. Ejecutar Script de Verificación
```bash
npm run verify:deployment
```

### 2. Verificaciones Manuales
```bash
# Verificar servicios
pm2 status

# Verificar conectividad a base de datos
npx prisma db push --accept-data-loss=false

# Verificar Redis
redis-cli ping

# Verificar aplicación
curl http://localhost:3000/api/health

# Verificar logs
pm2 logs --lines 100
```

### 3. Pruebas Funcionales
1. Acceder a `https://tu-dominio.com`
2. Iniciar sesión con credenciales de Moodle
3. Seleccionar un curso
4. Ejecutar un análisis de prueba

## Monitoreo

### Logs del Sistema
```bash
# Logs de PM2
pm2 logs

# Logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/*.log
```

### Métricas de PM2
```bash
pm2 monit
```

## Mantenimiento

### Actualizar la Aplicación
```bash
# Detener servicios
pm2 stop all

# Actualizar código
git pull origin main
npm install

# Actualizar base de datos
npx prisma migrate deploy

# Rebuild
npm run build

# Reiniciar servicios
pm2 restart all
```

### Backup de Base de Datos
```bash
# Crear backup
pg_dump -U profebot_user -h localhost profebot_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
psql -U profebot_user -h localhost profebot_db < backup_archivo.sql
```

### Limpiar Caché
```bash
# Limpiar Redis
redis-cli FLUSHDB

# Limpiar caché de Next.js
rm -rf .next/cache
```

## Solución de Problemas

### Error de Conexión a Base de Datos
```bash
# Verificar PostgreSQL
sudo systemctl status postgresql

# Verificar conexión
psql -U profebot_user -h localhost -d profebot_db
```

### Error de Redis
```bash
# Verificar Redis
sudo systemctl status redis-server

# Test conexión
redis-cli ping
```

### Error de Memoria
```bash
# Aumentar límite de memoria para Node.js
NODE_OPTIONS="--max-old-space-size=4096" pm2 start ecosystem.config.js
```

### Error 502 Bad Gateway
```bash
# Verificar si Next.js está corriendo
pm2 status

# Verificar puerto 3000
netstat -tlpn | grep 3000

# Reiniciar aplicación
pm2 restart app
```

## Scripts de Utilidad

### Health Check
```bash
#!/bin/bash
# health_check.sh

echo "Verificando servicios..."

# PostgreSQL
pg_isready -h localhost -p 5432 && echo "✓ PostgreSQL OK" || echo "✗ PostgreSQL ERROR"

# Redis
redis-cli ping > /dev/null && echo "✓ Redis OK" || echo "✗ Redis ERROR"

# Next.js
curl -s http://localhost:3000/api/health > /dev/null && echo "✓ Next.js OK" || echo "✗ Next.js ERROR"

# Worker
pm2 status worker --json | grep -q '"status":"online"' && echo "✓ Worker OK" || echo "✗ Worker ERROR"
```

## Seguridad

### Firewall (UFW)
```bash
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

### Permisos de Archivos
```bash
# Establecer permisos correctos
chmod 600 .env
chmod 755 -R .next
chmod 755 -R public
```

### Variables de Entorno Seguras
- Nunca commits `.env` a git
- Usa secrets managers en producción
- Rota las keys regularmente
- Usa contraseñas fuertes para bases de datos

## Contacto y Soporte

Para problemas con el despliegue:
1. Revisar logs: `pm2 logs`
2. Verificar estado de servicios: `pm2 status`
3. Consultar documentación de componentes específicos
4. Contactar al equipo de desarrollo

## Checklist Pre-Producción

- [ ] Variables de entorno configuradas
- [ ] Base de datos PostgreSQL funcionando
- [ ] Redis funcionando
- [ ] Migraciones de Prisma ejecutadas
- [ ] Build de producción exitoso
- [ ] PM2 configurado y funcionando
- [ ] Nginx configurado como proxy reverso
- [ ] SSL/HTTPS configurado
- [ ] Firewall configurado
- [ ] Backups automáticos configurados
- [ ] Monitoreo configurado
- [ ] Script de health check funcionando
- [ ] Pruebas de integración pasadas