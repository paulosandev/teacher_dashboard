import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { prisma } from '@/lib/db/prisma'
import { encrypt, decrypt } from '@/lib/utils/encryption'
import { createUserMoodleClient } from '@/lib/moodle/user-api-client'

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET: Obtiene el estado del token de Moodle del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userToken = await prisma.userMoodleToken.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        moodleUserId: true,
        moodleUsername: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        capabilities: true
      }
    })

    if (!userToken) {
      return NextResponse.json({
        hasToken: false,
        message: 'No hay token configurado'
      })
    }

    // Verificar si el token funciona
    const client = createUserMoodleClient(session.user.id)
    let isValid = false
    
    try {
      isValid = await client.testConnection()
    } catch (error) {
      console.log('Token inválido o expirado')
    }

    return NextResponse.json({
      hasToken: true,
      isActive: userToken.isActive,
      isValid,
      moodleUsername: userToken.moodleUsername,
      moodleUserId: userToken.moodleUserId,
      createdAt: userToken.createdAt,
      updatedAt: userToken.updatedAt,
      expiresAt: userToken.expiresAt,
      hasCapabilities: userToken.capabilities ? true : false
    })
    
  } catch (error) {
    console.error('Error obteniendo estado del token:', error)
    return NextResponse.json(
      { error: 'Error al obtener estado del token' },
      { status: 500 }
    )
  }
}

/**
 * POST: Configura o actualiza el token de Moodle del usuario
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { moodleToken, expiresAt } = body

    if (!moodleToken) {
      return NextResponse.json(
        { error: 'Token de Moodle requerido' },
        { status: 400 }
      )
    }

    // Validar el token con Moodle
    const { moodleClient: tempClient } = await import('@/lib/moodle/api-client')
    
    // Temporalmente usar el nuevo token para validar
    const originalToken = process.env.MOODLE_API_TOKEN
    process.env.MOODLE_API_TOKEN = moodleToken

    let tokenInfo: any = null
    
    try {
      // Intentar obtener información con el token
      const url = new URL(process.env.MOODLE_API_URL!)
      url.searchParams.append('wstoken', moodleToken)
      url.searchParams.append('wsfunction', 'core_webservice_get_site_info')
      url.searchParams.append('moodlewsrestformat', 'json')
      
      const response = await fetch(url.toString())
      const data = await response.json()
      
      if (data.exception) {
        throw new Error(data.message || 'Token inválido')
      }
      
      tokenInfo = data
      
    } catch (error: any) {
      // Restaurar token original
      process.env.MOODLE_API_TOKEN = originalToken
      
      return NextResponse.json(
        { error: `Token de Moodle inválido: ${error.message}` },
        { status: 400 }
      )
    } finally {
      // Restaurar token original
      process.env.MOODLE_API_TOKEN = originalToken
    }

    // Encriptar el token antes de guardarlo
    const encryptedToken = encrypt(moodleToken)

    // Guardar o actualizar el token en la base de datos
    const savedToken = await prisma.userMoodleToken.upsert({
      where: { userId: session.user.id },
      update: {
        token: encryptedToken,
        moodleUserId: tokenInfo.userid,
        moodleUsername: tokenInfo.username,
        capabilities: tokenInfo.functions || [],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        userId: session.user.id,
        token: encryptedToken,
        moodleUserId: tokenInfo.userid,
        moodleUsername: tokenInfo.username,
        capabilities: tokenInfo.functions || [],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Token configurado exitosamente',
      moodleUsername: tokenInfo.username,
      moodleFullName: tokenInfo.fullname,
      moodleUserId: tokenInfo.userid
    })
    
  } catch (error: any) {
    console.error('Error configurando token:', error)
    return NextResponse.json(
      { error: error.message || 'Error al configurar token' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Elimina el token de Moodle del usuario
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Desactivar el token (no lo eliminamos por auditoría)
    await prisma.userMoodleToken.update({
      where: { userId: session.user.id },
      data: { isActive: false }
    })

    return NextResponse.json({
      success: true,
      message: 'Token eliminado exitosamente'
    })
    
  } catch (error) {
    console.error('Error eliminando token:', error)
    return NextResponse.json(
      { error: 'Error al eliminar token' },
      { status: 500 }
    )
  }
}
