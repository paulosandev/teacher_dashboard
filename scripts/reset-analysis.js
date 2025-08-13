const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function resetAnalysis() {
  try {
    console.log('🔄 Reseteando análisis existentes...')
    
    // Eliminar todos los análisis existentes
    const deletedCount = await prisma.analysisResult.deleteMany({})
    console.log(`✅ ${deletedCount.count} análisis eliminados`)
    
    // Marcar todos los cursos para re-sincronización
    const updatedCourses = await prisma.course.updateMany({
      data: {
        lastSync: new Date(0) // Resetear fecha de sincronización
      }
    })
    console.log(`🔄 ${updatedCourses.count} cursos marcados para re-sincronización`)
    
    console.log('✨ Reset completado. Los análisis se regenerarán con la nueva estructura.')
    
  } catch (error) {
    console.error('❌ Error durante el reset:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetAnalysis()
