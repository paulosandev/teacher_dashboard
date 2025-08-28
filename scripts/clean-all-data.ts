#!/usr/bin/env tsx

/**
 * Script para limpiar TODA la información de la aplicación
 * CUIDADO: Esto eliminará todos los análisis, cursos, grupos y caché
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function cleanAllData() {
  console.log('🧹 Iniciando limpieza completa del sistema...\n');
  
  try {
    // 1. Limpiar Base de Datos PostgreSQL
    console.log('🗃️  Limpiando base de datos PostgreSQL...');
    
    await prisma.$transaction([
      prisma.analysisQueue.deleteMany(),
      prisma.courseCache.deleteMany(),
      prisma.jobLog.deleteMany(),
      prisma.activityAnalysis.deleteMany(),
      prisma.analysisResult.deleteMany(),
      prisma.userMoodleToken.deleteMany(),
      prisma.group.deleteMany(),
      prisma.course.deleteMany(),
    ]);
    
    console.log('✅ Base de datos PostgreSQL limpiada');
    
    // 2. Limpiar Redis
    console.log('\n🔴 Limpiando caché de Redis...');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Obtener todas las keys con el prefijo de la aplicación
    const keys = await redis.keys('profebot:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`✅ Eliminadas ${keys.length} keys de Redis`);
    } else {
      console.log('ℹ️  No hay keys de Redis para eliminar');
    }
    
    // Limpiar también keys genéricas que puedan existir
    const allKeys = await redis.keys('*');
    const appKeys = allKeys.filter(key => 
      key.includes('moodle') || 
      key.includes('course') || 
      key.includes('analysis') ||
      key.includes('user:') ||
      key.includes('forum') ||
      key.includes('activity')
    );
    
    if (appKeys.length > 0) {
      await redis.del(...appKeys);
      console.log(`✅ Eliminadas ${appKeys.length} keys adicionales de Redis`);
    }
    
    await redis.disconnect();
    console.log('✅ Redis limpiado y desconectado');
    
    // 3. Mostrar conteo final
    console.log('\n📊 Verificando limpieza...');
    const counts = await Promise.all([
      prisma.course.count(),
      prisma.group.count(),
      prisma.analysisResult.count(),
      prisma.activityAnalysis.count(),
      prisma.courseCache.count(),
      prisma.analysisQueue.count(),
      prisma.jobLog.count(),
      prisma.userMoodleToken.count(),
    ]);
    
    const [courses, groups, analysisResults, activityAnalysis, courseCache, analysisQueue, jobLog, userTokens] = counts;
    
    console.log(`
📈 ESTADO FINAL:
   🏫 Cursos: ${courses}
   👥 Grupos: ${groups} 
   📊 Análisis de Resultado: ${analysisResults}
   📋 Análisis de Actividad: ${activityAnalysis}
   💾 Caché de Curso: ${courseCache}
   🔄 Cola de Análisis: ${analysisQueue}
   📝 Logs de Jobs: ${jobLog}
   🔑 Tokens de Usuario: ${userTokens}
`);
    
    const totalRecords = counts.reduce((sum, count) => sum + count, 0);
    
    if (totalRecords === 0) {
      console.log('🎉 ¡LIMPIEZA COMPLETADA! El sistema está como nuevo.');
      console.log('\nAhora puedes:');
      console.log('1. Reiniciar la aplicación: npm run dev');
      console.log('2. Acceder como usuario nuevo');
      console.log('3. Seleccionar cursos desde Moodle');
    } else {
      console.log(`⚠️  Advertencia: Aún quedan ${totalRecords} registros en el sistema`);
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Verificar confirmación antes de ejecutar
if (process.argv.includes('--force')) {
  cleanAllData();
} else {
  console.log('🚨 ADVERTENCIA: Este script eliminará TODOS los datos de la aplicación.');
  console.log('');
  console.log('Esto incluye:');
  console.log('- Todos los cursos y grupos sincronizados');
  console.log('- Todos los análisis generados');
  console.log('- Todo el caché de Redis');
  console.log('- Todos los tokens de usuario');
  console.log('');
  console.log('Para confirmar, ejecuta:');
  console.log('npx tsx scripts/clean-all-data.ts --force');
}