#!/usr/bin/env tsx

/**
 * Script para limpiar ABSOLUTAMENTE TODO del sistema
 * Incluye: PostgreSQL, Redis, CourseCache, Sesiones NextAuth
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function cleanEverything() {
  console.log('🧹 LIMPIEZA TOTAL DEL SISTEMA...\n');
  
  try {
    // 1. Limpiar TODAS las tablas de la BD (incluyendo CourseCache)
    console.log('🗃️ Limpiando PostgreSQL COMPLETAMENTE...');
    
    await prisma.$transaction([
      // Limpiar tablas que NO habíamos limpiado antes
      prisma.courseCache.deleteMany(),
      prisma.jobLog.deleteMany(),
      prisma.activityAnalysis.deleteMany(),
      prisma.analysisQueue.deleteMany(),
      
      // Limpiar las tablas principales
      prisma.analysisResult.deleteMany(),
      prisma.group.deleteMany(),
      prisma.course.deleteMany(),
    ]);
    
    console.log('✅ PostgreSQL completamente limpio');
    
    // 2. Limpiar Redis (TODO)
    console.log('\n🔴 Limpiando Redis COMPLETAMENTE...');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    await redis.flushall();
    console.log('✅ Redis completamente limpio');
    
    await redis.disconnect();
    
    // 3. Verificar conteos finales
    console.log('\n📊 VERIFICACIÓN FINAL...');
    const counts = await Promise.all([
      prisma.course.count(),
      prisma.group.count(),
      prisma.analysisResult.count(),
      prisma.activityAnalysis.count(),
      prisma.courseCache.count(),
      prisma.analysisQueue.count(),
      prisma.jobLog.count(),
    ]);
    
    const [courses, groups, analysisResults, activityAnalysis, courseCache, analysisQueue, jobLog] = counts;
    
    console.log(`
📈 ESTADO FINAL DE LA BASE DE DATOS:
   🏫 Cursos: ${courses}
   👥 Grupos: ${groups} 
   📊 Análisis de Resultado: ${analysisResults}
   📋 Análisis de Actividad: ${activityAnalysis}
   💾 Caché de Curso: ${courseCache}
   🔄 Cola de Análisis: ${analysisQueue}
   📝 Logs de Jobs: ${jobLog}
`);
    
    const totalRecords = counts.reduce((sum, count) => sum + count, 0);
    
    if (totalRecords === 0) {
      console.log('🎉 ¡LIMPIEZA TOTAL COMPLETADA!');
      console.log('\n📋 PARA COMPLETAR LA LIMPIEZA:');
      console.log('1. 🌐 Usa ventana INCÓGNITO en el navegador');
      console.log('2. 🔄 O limpia cookies de localhost:3000 manualmente');
      console.log('3. 🔑 Los tokens de NextAuth se limpiarán automáticamente');
      console.log('4. ▶️ Reinicia: npm run dev');
    } else {
      console.log(`⚠️ Advertencia: Aún quedan ${totalRecords} registros`);
    }
    
  } catch (error) {
    console.error('❌ Error durante limpieza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar limpieza
cleanEverything();