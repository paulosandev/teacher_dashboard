#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('🧹 Limpiando base de datos...');
  
  try {
    // Limpiar en orden correcto (FK dependencies)
    await prisma.analysisResult.deleteMany();
    console.log('✅ AnalysisResult limpiado');
    
    await prisma.group.deleteMany();
    console.log('✅ Group limpiado');
    
    await prisma.course.deleteMany();
    console.log('✅ Course limpiado');
    
    await prisma.userMoodleToken.deleteMany();
    console.log('✅ UserMoodleToken limpiado');
    
    // Verificar conteos finales
    const counts = await Promise.all([
      prisma.course.count(),
      prisma.group.count(),
      prisma.analysisResult.count(),
      prisma.userMoodleToken.count(),
    ]);
    
    console.log(`
📊 ESTADO FINAL:
   🏫 Cursos: ${counts[0]}
   👥 Grupos: ${counts[1]}
   📊 Análisis: ${counts[2]}
   🔑 Tokens: ${counts[3]}
    `);
    
    console.log('✅ Base de datos limpiada completamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();