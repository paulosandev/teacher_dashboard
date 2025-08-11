-- Script para crear la base de datos en PostgreSQL
-- Ejecutar este script con un usuario que tenga permisos de creación de bases de datos

-- Eliminar la base de datos si existe (CUIDADO: Esto borrará todos los datos)
-- DROP DATABASE IF EXISTS academic_analysis;

-- Crear la base de datos
CREATE DATABASE academic_analysis
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- Conectarse a la base de datos
\c academic_analysis;

-- Crear extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

COMMENT ON DATABASE academic_analysis
    IS 'Base de datos para el Sistema de Análisis Académico con IA';

-- Mensaje de confirmación
\echo 'Base de datos "academic_analysis" creada exitosamente.'
\echo 'Ahora puedes ejecutar: npm run db:migrate'
