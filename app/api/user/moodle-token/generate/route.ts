import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAuthService } from '@/lib/moodle/auth-service'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ 
        error: 'Se requiere usuario y contraseña' 
      }, { status: 400 })
    }

    // Usar el servicio de autenticación para generar y guardar el token
    const authService = new MoodleAuthService()
    const result = await authService.authenticateWithCredentials(
      session.user.id,
      username,
      password
    )

    if (!result.success) {
      return NextResponse.json({ 
        success: false,
        error: result.error || 'Error al generar token'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Token generado y guardado exitosamente',
      tokenType: result.tokenType
    })

  } catch (error: any) {
    console.error('Error generando token:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 })
  }
}
