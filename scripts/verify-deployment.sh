#!/bin/bash

# Script de verificación rápida de despliegue
# Para uso del equipo DevOps

echo "========================================="
echo "    VERIFICACIÓN DE DESPLIEGUE - PROFEBOT"
echo "========================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
ERRORS=0
WARNINGS=0

# Función para verificar comando
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 instalado"
        return 0
    else
        echo -e "${RED}✗${NC} $1 no encontrado"
        ((ERRORS++))
        return 1
    fi
}

# Función para verificar archivo
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} Archivo: $1"
        return 0
    else
        echo -e "${RED}✗${NC} Archivo faltante: $1"
        ((ERRORS++))
        return 1
    fi
}

# Función para verificar directorio
check_directory() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} Directorio: $1"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Directorio faltante: $1"
        ((WARNINGS++))
        return 1
    fi
}

# Función para verificar variable de entorno
check_env() {
    if [ -z "${!1}" ]; then
        echo -e "${RED}✗${NC} Variable no configurada: $1"
        ((ERRORS++))
        return 1
    else
        echo -e "${GREEN}✓${NC} Variable configurada: $1"
        return 0
    fi
}

echo "1. VERIFICANDO REQUISITOS DEL SISTEMA"
echo "-------------------------------------"
check_command node
check_command npm
check_command psql
check_command redis-cli

echo ""
echo "2. VERIFICANDO ARCHIVOS CRÍTICOS"
echo "-------------------------------------"
check_file "package.json"
check_file "next.config.mjs"
check_file "prisma/schema.prisma"
check_file ".env"

echo ""
echo "3. VERIFICANDO DIRECTORIOS"
echo "-------------------------------------"
check_directory "app"
check_directory "components"
check_directory "lib"
check_directory "public"
check_directory "node_modules"
check_directory ".next"

# Cargar variables de entorno si existe .env
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    
    echo ""
    echo "4. VERIFICANDO VARIABLES DE ENTORNO"
    echo "-------------------------------------"
    check_env "DATABASE_URL"
    check_env "REDIS_URL"
    check_env "NEXTAUTH_URL"
    check_env "NEXTAUTH_SECRET"
    check_env "OPENAI_API_KEY"
    check_env "MOODLE_BASE_URL"
else
    echo ""
    echo -e "${RED}✗${NC} No se puede verificar variables de entorno sin archivo .env"
    ((ERRORS++))
fi

echo ""
echo "5. VERIFICANDO SERVICIOS"
echo "-------------------------------------"

# Verificar PostgreSQL
if command -v psql &> /dev/null && [ ! -z "$DATABASE_URL" ]; then
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} PostgreSQL conectado"
    else
        echo -e "${RED}✗${NC} No se puede conectar a PostgreSQL"
        ((ERRORS++))
    fi
fi

# Verificar Redis
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✓${NC} Redis conectado"
    else
        echo -e "${RED}✗${NC} No se puede conectar a Redis"
        ((ERRORS++))
    fi
fi

# Verificar build de Next.js
if [ -d ".next" ]; then
    echo -e "${GREEN}✓${NC} Build de Next.js existe"
else
    echo -e "${YELLOW}⚠${NC} Build de Next.js no existe - ejecutar: npm run build"
    ((WARNINGS++))
fi

echo ""
echo "========================================="
echo "              RESUMEN"
echo "========================================="

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ SISTEMA LISTO PARA DESPLIEGUE${NC}"
        echo "Todos los checks pasaron exitosamente."
    else
        echo -e "${YELLOW}⚠ SISTEMA FUNCIONAL CON ADVERTENCIAS${NC}"
        echo "Errores: $ERRORS | Advertencias: $WARNINGS"
    fi
    exit 0
else
    echo -e "${RED}✗ SISTEMA REQUIERE ATENCIÓN${NC}"
    echo "Errores: $ERRORS | Advertencias: $WARNINGS"
    echo ""
    echo "Por favor, corrige los errores antes de desplegar."
    exit 1
fi