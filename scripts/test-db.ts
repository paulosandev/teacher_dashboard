#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testDatabase() {
  console.log('🔍 Probando conexión a la base de datos...\n')
  
  try {
    // Contar usuarios
    const userCount = await prisma.user.count()
    console.log(`✅ Usuarios: ${userCount}`)
    
    // Contar cursos
    const courseCount = await prisma.course.count()
    console.log(`✅ Cursos: ${courseCount}`)
    
    // Contar actividades
    const activityCount = await prisma.activity.count()
    console.log(`✅ Actividades: ${activityCount}`)
    
    // Contar foros
    const forumCount = await prisma.forum.count()
    console.log(`✅ Foros: ${forumCount}`)
    
    // Contar resultados de análisis
    const analysisCount = await prisma.analysisResult.count()
    console.log(`✅ Resultados de análisis: ${analysisCount}`)
    
    // Mostrar el usuario de prueba
    const testUser = await prisma.user.findUnique({
      where: { email: 'profesor@test.com' },
      select: { 
        email: true, 
        username: true, 
        matricula: true,
        name: true 
      }
    })
    
    if (testUser) {
      console.log('\n👤 Usuario de prueba encontrado:')
      console.log(`   Email: ${testUser.email}`)
      console.log(`   Username: ${testUser.username}`)
      console.log(`   Matrícula: ${testUser.matricula}`)
      console.log(`   Nombre: ${testUser.name}`)
    }
    
    console.log('\n🎉 ¡La base de datos está funcionando correctamente!')
    
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testDatabase()
