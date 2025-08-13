import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleTokenGenerator } from '@/lib/moodle/token-generator'

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

    // Generar token
    const tokenGenerator = new MoodleTokenGenerator()
    const result = await tokenGenerator.generateToken(username, password)

    if (!result.success) {
      return NextResponse.json({ 
        success: false,
        error: result.error || 'Error al generar token'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Token generado y guardado exitosamente'
    })

  } catch (error: any) {
    console.error('Error generando token:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 })
  }
}
