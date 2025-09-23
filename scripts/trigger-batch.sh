#!/bin/bash

# Script para ejecutar el proceso batch manualmente
# Útil para disparar sincronización desde producción o testing

# Configuración
API_URL="${API_URL:-http://localhost:3000}"
BATCH_SECRET="${BATCH_SECRET:-your-secret-key-change-in-production}"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Ejecutando Proceso Batch Manual${NC}"
echo "======================================"
echo "URL: $API_URL/api/batch/trigger"
echo ""

# Verificar estado actual
echo -e "${YELLOW}📊 Verificando estado actual...${NC}"
STATUS_RESPONSE=$(curl -s "$API_URL/api/batch/trigger?secret=$BATCH_SECRET")
echo "Estado: $STATUS_RESPONSE"
echo ""

# Preguntar qué tipo de ejecución
echo "Selecciona el tipo de ejecución:"
echo "1) Proceso completo (sincronización + análisis)"
echo "2) Solo análisis (sin sincronización)"
echo "3) Proceso completo para aula 101"
echo "4) Solo análisis para aula 101"
echo "5) Verificar estado solamente"
echo ""
read -p "Opción (1-5): " option

case $option in
  1)
    echo -e "${GREEN}Ejecutando proceso completo...${NC}"
    BODY='{}'
    ;;
  2)
    echo -e "${GREEN}Ejecutando solo análisis...${NC}"
    BODY='{"onlyAnalysis": true}'
    ;;
  3)
    echo -e "${GREEN}Ejecutando proceso completo para aula 101...${NC}"
    BODY='{"aulaIds": ["101"]}'
    ;;
  4)
    echo -e "${GREEN}Ejecutando solo análisis para aula 101...${NC}"
    BODY='{"aulaIds": ["101"], "onlyAnalysis": true}'
    ;;
  5)
    echo -e "${YELLOW}Estado actual:${NC}"
    curl -s "$API_URL/api/batch/trigger?secret=$BATCH_SECRET" | jq '.'
    exit 0
    ;;
  *)
    echo -e "${RED}Opción inválida${NC}"
    exit 1
    ;;
esac

# Ejecutar el proceso
echo ""
echo -e "${YELLOW}📡 Enviando solicitud...${NC}"
RESPONSE=$(curl -s -X POST "$API_URL/api/batch/trigger" \
  -H "Content-Type: application/json" \
  -H "x-batch-secret: $BATCH_SECRET" \
  -d "$BODY")

# Mostrar respuesta
echo -e "${GREEN}Respuesta del servidor:${NC}"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Verificar si fue exitoso
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo -e "${GREEN}✅ Proceso iniciado exitosamente${NC}"
else
  echo ""
  echo -e "${RED}❌ Error al ejecutar el proceso${NC}"
  exit 1
fi