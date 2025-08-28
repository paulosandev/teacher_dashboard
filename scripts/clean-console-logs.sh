#!/bin/bash

# Script para limpiar console.logs excesivos de archivos principales
# Mantiene solo console.error para debugging

echo "🧹 Limpiando console.logs excesivos..."

# Archivos a limpiar (los más verbosos)
MOODLE_FILES=(
    "lib/moodle/robust-group-client.ts"
    "lib/auth/moodle-auth-service.ts"
    "lib/moodle/auth-service.ts"
    "hooks/useMoodleData.ts"
)

API_FILES=(
    "app/api/analysis/cache/route.ts"
    "app/api/analysis/route.ts"
    "app/dashboard/v2/page.tsx"
)

COMPONENT_FILES=(
    "components/dashboard/course-selector.tsx"
    "components/dashboard/intelligent-dashboard-content.tsx"
)

# Función para comentar console.logs informativos
clean_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo "🔧 Limpiando: $file"
        
        # Comentar console.log informativos (emoji y textos descriptivos)
        sed -i '' 's/^[[:space:]]*console\.log.*🔍.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*🎯.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*✅.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*🔄.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*📊.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*📡.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*👨‍🏫.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*👥.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*📌.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*🚀.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*🔑.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*📋.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*📈.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*📖.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*🆔.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*━━━.*$/\/\/ &/' "$file"
        sed -i '' 's/^[[:space:]]*console\.log.*💾.*$/\/\/ &/' "$file"
        
        echo "   ✓ $file limpiado"
    else
        echo "   ⚠️ $file no encontrado"
    fi
}

# Limpiar archivos de Moodle
echo "🔄 Limpiando servicios de Moodle..."
for file in "${MOODLE_FILES[@]}"; do
    clean_file "$file"
done

# Limpiar archivos de API
echo "🔄 Limpiando rutas de API..."
for file in "${API_FILES[@]}"; do
    clean_file "$file"
done

# Limpiar componentes
echo "🔄 Limpiando componentes..."
for file in "${COMPONENT_FILES[@]}"; do
    clean_file "$file"
done

echo ""
echo "✅ Limpieza completada!"
echo "📝 Los console.error se mantuvieron para debugging"
echo "🔍 Los console.log informativos fueron comentados"