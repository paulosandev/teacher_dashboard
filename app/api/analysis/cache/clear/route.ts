import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Singleton pattern para Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    console.log(`🗑️ Iniciando limpieza de caché solicitada por: ${session.user.name}`)

    // Contar análisis antes de la limpieza
    const totalBeforeDelete = await prisma.activityAnalysis.count()
    console.log(`📊 Total de análisis en caché antes de la limpieza: ${totalBeforeDelete}`)

    if (totalBeforeDelete === 0) {
      return NextResponse.json({
        success: true,
        message: 'El caché ya estaba vacío',
        deletedCount: 0
      })
    }

    // Eliminar todos los análisis de la base de datos
    const deleteResult = await prisma.activityAnalysis.deleteMany()
    
    console.log(`✅ Caché limpiado exitosamente. Eliminados: ${deleteResult.count} análisis`)

    return NextResponse.json({
      success: true,
      message: `Caché limpiado exitosamente. Se eliminaron ${deleteResult.count} análisis.`,
      deletedCount: deleteResult.count,
      previousCount: totalBeforeDelete
    })

  } catch (error: any) {
    console.error('❌ Error limpiando caché:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Error interno del servidor',
        success: false
      },
      { status: 500 }
    )
  }
}