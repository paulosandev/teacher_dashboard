#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('🧹 Limpiando base de datos...');
  
  try {
    // Solo limpiar las tablas que sabemos que existen
    await prisma.analysisResult.deleteMany();
    console.log('✅ AnalysisResult limpiado');
    
    await prisma.group.deleteMany();
    console.log('✅ Group limpiado');
    
    await prisma.course.deleteMany();
    console.log('✅ Course limpiado');
    
    // Verificar conteos finales
    const counts = await Promise.all([
      prisma.course.count(),
      prisma.group.count(),
      prisma.analysisResult.count(),
    ]);
    
    console.log(`
📊 ESTADO FINAL:
   🏫 Cursos: ${counts[0]}
   👥 Grupos: ${counts[1]}
   📊 Análisis: ${counts[2]}
    `);
    
    console.log('🎉 ¡Base de datos limpiada completamente!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();