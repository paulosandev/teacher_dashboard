import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { MoodleAuthService } from '@/lib/moodle/auth-service';

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verificar que el usuario esté autenticado
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener las credenciales del body
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username y password son requeridos' },
        { status: 400 }
      );
    }

    // Obtener el usuario de la base de datos
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Intentar autenticar con Moodle y obtener el token
    const authService = new MoodleAuthService();
    const tokenData = await authService.authenticateWithCredentials(username, password, user.id);

    if (!tokenData.success || !tokenData.token) {
      return NextResponse.json(
        { error: tokenData.message || 'Error al autenticar con Moodle' },
        { status: 401 }
      );
    }

    // El token ya se guarda automáticamente en authenticateWithCredentials
    // Solo necesitamos confirmar el éxito

    return NextResponse.json({
      success: true,
      message: 'Token de Moodle obtenido exitosamente',
      data: {
        hasToken: true,
        username: username
      }
    });

  } catch (error) {
    console.error('Error en autenticación con Moodle:', error);
    
    // Manejar errores específicos
    if (error instanceof Error) {
      if (error.message.includes('Invalid login')) {
        return NextResponse.json(
          { error: 'Credenciales inválidas para Moodle' },
          { status: 401 }
        );
      }
      if (error.message.includes('Network')) {
        return NextResponse.json(
          { error: 'Error de conexión con Moodle' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Endpoint para verificar si el usuario tiene un token
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        moodleToken: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const hasToken = !!user.moodleToken?.token;
    
    return NextResponse.json({
      hasToken,
      username: user.moodleToken?.moodleUsername || null,
      lastUpdated: user.moodleToken?.updatedAt || null
    });

  } catch (error) {
    console.error('Error verificando token de Moodle:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Endpoint para eliminar el token del usuario
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar el token si existe
    await prisma.userMoodleToken.deleteMany({
      where: { userId: user.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Token de Moodle eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando token de Moodle:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
