import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { forumAnalysisService } from '@/lib/services/forum-analysis-service';

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { action, forumId, forumName, courseId } = await request.json();

    switch (action) {
      case 'analyze-forum':
        return await handleAnalyzeForum(forumId, forumName, courseId, session.user.id);
      
      case 'get-forums':
        return await handleGetForums(courseId);
      
      case 'get-history':
        return await handleGetHistory(session.user.id);
      
      case 'health-check':
        return await handleHealthCheck();
      
      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Error en API de análisis:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

async function handleAnalyzeForum(
  forumId: number,
  forumName: string,
  courseId: number,
  userId: string
) {
  try {
    console.log(`🎯 Iniciando análisis del foro ${forumId} para usuario ${userId}`);
    
    if (!forumId || !forumName || !courseId) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: forumId, forumName, courseId' },
        { status: 400 }
      );
    }

    const result = await forumAnalysisService.analyzeForumComplete(
      forumId,
      forumName,
      courseId,
      userId
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Error en el análisis',
          details: result.error
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      analysisId: result.analysisId,
      analysis: result.analysisResult,
      forum: result.forumData
    });

  } catch (error) {
    console.error('❌ Error analizando foro:', error);
    return NextResponse.json(
      { 
        error: 'Error al analizar el foro',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

async function handleGetForums(courseId: number) {
  try {
    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId es requerido' },
        { status: 400 }
      );
    }

    const forums = await forumAnalysisService.getCourseForums(courseId);

    return NextResponse.json({
      success: true,
      forums
    });

  } catch (error) {
    console.error('❌ Error obteniendo foros:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener foros',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

async function handleGetHistory(userId: string) {
  try {
    const history = await forumAnalysisService.getUserAnalysisHistory(userId, 10);

    return NextResponse.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener historial',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

async function handleHealthCheck() {
  try {
    const health = await forumAnalysisService.healthCheck();

    return NextResponse.json({
      success: true,
      services: health,
      allHealthy: health.moodle && health.openai && health.database
    });

  } catch (error) {
    console.error('❌ Error en health check:', error);
    return NextResponse.json(
      { 
        error: 'Error en health check',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'health') {
    return handleHealthCheck();
  }

  // Si no hay acción, devolver todos los análisis del usuario
  return handleGetUserAnalysis(request);
}

async function handleGetUserAnalysis(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    console.log('📈 Obteniendo análisis para usuario:', session.user.email);

    // Obtener análisis del usuario desde la base de datos
    const { prisma } = await import('@/lib/db/prisma');
    
    const analysisResults = await prisma.analysisResult.findMany({
      where: {
        userId: session.user.id,
        isLatest: true
      },
      orderBy: {
        processedAt: 'desc'
      }
    });

    console.log(`📈 Encontrados ${analysisResults.length} análisis para el usuario`);

    // Convertir a formato compatible con el dashboard
    const dashboardCards = analysisResults.map(analysis => {
      // Extraer información de rawData para análisis híbrido
      const rawData = analysis.rawData as any;
      const moodleCourseId = rawData?.moodleCourseId || analysis.courseId.replace('moodle_', '');
      
      return {
        id: analysis.id,
        courseId: analysis.courseId,
        moodleCourseId: moodleCourseId,
        groupId: rawData?.selectedGroupId,
        title: getAnalysisTitle(analysis),
        analysisType: analysis.analysisType,
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
        alerts: Array.isArray(analysis.alerts) ? analysis.alerts : [],
        nextStep: analysis.nextStep,
        processedAt: analysis.processedAt,
        confidence: analysis.confidence,
        rawData: rawData
      };
    });

    console.log(`✅ Devolviendo ${dashboardCards.length} tarjetas de dashboard`);

    // Crear respuesta con headers anti-caché
    const response = NextResponse.json(dashboardCards);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;

  } catch (error) {
    console.error('❌ Error obteniendo análisis del usuario:', error);
    return NextResponse.json(
      { 
        error: 'Error al obtener análisis',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

function getAnalysisTitle(analysis: any): string {
  switch (analysis.analysisType) {
    case 'FORUM_PARTICIPATION':
      return analysis.rawData?.[0]?.forumName || 'Participación en foro';
    case 'ACTIVITY_SUBMISSION':
      return 'Envíos de actividad';
    default:
      return 'Análisis';
  }
}

function mapAnalysisTypeToResource(type: string): string {
  switch (type) {
    case 'FORUM_PARTICIPATION':
      return 'Foro';
    case 'ACTIVITY_SUBMISSION':
      return 'Actividad';
    default:
      return 'Recurso';
  }
}
