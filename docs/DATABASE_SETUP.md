# 🗄️ Configuración de Base de Datos

## Instalación de PostgreSQL

### macOS (con Homebrew)
```bash
# Instalar PostgreSQL
brew install postgresql@14

# Iniciar el servicio
brew services start postgresql@14

# Verificar que esté funcionando
psql --version
```

### Linux (Ubuntu/Debian)
```bash
# Actualizar paquetes
sudo apt update

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib

# Iniciar el servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows
1. Descargar el instalador desde [postgresql.org](https://www.postgresql.org/download/windows/)
2. Ejecutar el instalador y seguir las instrucciones
3. Recordar el puerto (por defecto 5432) y la contraseña del usuario postgres

## Crear la Base de Datos

### Opción 1: Usando el script SQL (Recomendado)
```bash
# Con usuario postgres
psql -U postgres -f scripts/create-db.sql

# O si tienes un usuario específico
psql -U tu_usuario -f scripts/create-db.sql
```

### Opción 2: Manualmente
```bash
# Conectarse a PostgreSQL
psql -U postgres

# En la consola de PostgreSQL:
CREATE DATABASE academic_analysis;
\q
```

## Configurar Variables de Entorno

Edita el archivo `.env.local` y actualiza la URL de la base de datos:

```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/academic_analysis?schema=public"
```

### Formato de la URL:
- **usuario**: Tu usuario de PostgreSQL (por defecto `postgres`)
- **contraseña**: La contraseña de tu usuario
- **localhost**: El host (usa `localhost` para desarrollo local)
- **5432**: El puerto (por defecto 5432)
- **academic_analysis**: El nombre de la base de datos

### Ejemplos:
```env
# Usuario postgres sin contraseña (común en desarrollo local)
DATABASE_URL="postgresql://postgres@localhost:5432/academic_analysis?schema=public"

# Usuario postgres con contraseña
DATABASE_URL="postgresql://postgres:mi_password@localhost:5432/academic_analysis?schema=public"

# Usuario personalizado
DATABASE_URL="postgresql://mi_usuario:mi_password@localhost:5432/academic_analysis?schema=public"
```

## Ejecutar Migraciones

### Primera vez (crear las tablas)
```bash
# Generar la migración inicial
npm run db:migrate

# Te pedirá un nombre para la migración, puedes usar: initial_schema
```

### Aplicar cambios al esquema (sin migraciones)
```bash
# Para desarrollo rápido (sobrescribe el esquema)
npm run db:push
```

### Resetear la base de datos (CUIDADO: Borra todos los datos)
```bash
npm run db:reset
```

## Poblar con Datos de Prueba

```bash
# Ejecutar el seed
npm run db:seed
```

Esto creará:
- 1 usuario profesor (profesor@test.com / password123)
- 2 cursos
- 2 grupos
- 2 actividades
- 2 foros
- 2 resultados de análisis de ejemplo

## Verificar la Configuración

### Ejecutar el script de verificación
```bash
npm run check
```

### Abrir Prisma Studio (interfaz visual)
```bash
npm run db:studio
```
Esto abrirá un navegador en http://localhost:5555 donde podrás ver y editar los datos.

## Comandos Útiles

```bash
# Ver el estado de las migraciones
npx prisma migrate status

# Generar el cliente de Prisma después de cambios en el esquema
npm run db:generate

# Ver los logs de PostgreSQL (macOS)
tail -f /usr/local/var/log/postgresql@14.log

# Conectarse a la base de datos
psql -U postgres -d academic_analysis
```

## Solución de Problemas

### Error: "role does not exist"
```bash
# Crear tu usuario en PostgreSQL
sudo -u postgres createuser --interactive
```

### Error: "password authentication failed"
1. Edita el archivo `pg_hba.conf`:
   - macOS: `/usr/local/var/postgresql@14/pg_hba.conf`
   - Linux: `/etc/postgresql/14/main/pg_hba.conf`

2. Cambia `md5` o `scram-sha-256` por `trust` para desarrollo local

3. Reinicia PostgreSQL:
   ```bash
   brew services restart postgresql@14  # macOS
   sudo systemctl restart postgresql    # Linux
   ```

### Error: "database does not exist"
```bash
# Crear la base de datos manualmente
psql -U postgres -c "CREATE DATABASE academic_analysis;"
```

### Error al conectar con Prisma
```bash
# Verificar la conexión
npx prisma db pull

# Si funciona, deberías ver:
# "Introspecting based on datasource defined in prisma/schema.prisma"
```

## 🎯 Checklist de Configuración

- [ ] PostgreSQL instalado y funcionando
- [ ] Base de datos `academic_analysis` creada
- [ ] Variables de entorno configuradas en `.env.local`
- [ ] Migraciones ejecutadas (`npm run db:migrate`)
- [ ] Datos de prueba cargados (`npm run db:seed`)
- [ ] Prisma Studio funciona (`npm run db:studio`)

## 📚 Referencias

- [Documentación de Prisma](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma con PostgreSQL](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
