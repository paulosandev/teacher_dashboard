import { moodleClient } from '../moodle/api-client';
import { openaiClient, type AnalysisResult, type ForumAnalysisInput } from '../ai/openai-client';
import { prisma } from '../db/prisma';

export interface ForumData {
  id: number;
  name: string;
  intro: string;
  course: {
    id: number;
    name: string;
    shortname: string;
  };
}

export interface AnalysisJobResult {
  success: boolean;
  analysisId?: string;
  error?: string;
  forumData?: ForumData;
  analysisResult?: AnalysisResult;
}

class ForumAnalysisService {
  /**
   * Obtiene todos los foros de un curso específico
   */
  async getCourseForums(courseId: number): Promise<ForumData[]> {
    try {
      console.log(`📚 Obteniendo foros del curso ${courseId}...`);
      
      const forums = await moodleClient.getCourseForums(courseId);
      
      return forums.map(forum => ({
        id: forum.id,
        name: forum.name,
        intro: forum.intro,
        course: {
          id: forum.course,
          name: 'Curso', // TODO: obtener nombre real del curso
          shortname: 'CURSO'
        }
      }));
    } catch (error) {
      console.error('❌ Error obteniendo foros:', error);
      return [];
    }
  }

  /**
   * Obtiene los datos completos de un foro (discusiones y respuestas) desde Moodle
   */
  async getForumAnalysisData(forumId: number, forumName: string): Promise<ForumAnalysisInput> {
    try {
      console.log(`🔍 Obteniendo datos completos del foro ${forumId} (${forumName})...`);
      
      // Obtener discusiones del foro
      const discussions = await moodleClient.getForumDiscussions(forumId);
      
      if (discussions.length === 0) {
        console.log('⚠️ No se encontraron discusiones en el foro');
        return {
          forumName,
          discussions: []
        };
      }
      
      console.log(`📋 Encontradas ${discussions.length} discusiones. Obteniendo posts...`);
      
      // Para cada discusión, obtener todos los posts
      const discussionsWithPosts = await Promise.all(
        discussions.map(async (discussion) => {
          try {
            const posts = await moodleClient.getDiscussionPosts(discussion.id);
            
            // El primer post es la discusión original
            const mainPost = posts.find(post => post.parent === 0) || posts[0];
            
            // Los posts restantes son respuestas
            const replies = posts
              .filter(post => post.parent !== 0)
              .map(post => ({
                author: `Usuario-${post.userid}`, // TODO: Mapear a nombres reales
                content: this.cleanHtmlContent(post.message),
                timestamp: new Date(post.created * 1000).toISOString()
              }));
            
            return {
              title: discussion.name,
              author: `Usuario-${discussion.usermodified}`, // TODO: Mapear a nombres reales
              content: mainPost ? this.cleanHtmlContent(mainPost.message) : 'Contenido no disponible',
              replies,
              timestamp: new Date(discussion.timemodified * 1000).toISOString()
            };
          } catch (error) {
            console.error(`❌ Error obteniendo posts para discusión ${discussion.id}:`, error);
            return {
              title: discussion.name,
              author: 'Usuario desconocido',
              content: 'Error al obtener contenido',
              replies: [],
              timestamp: new Date(discussion.timemodified * 1000).toISOString()
            };
          }
        })
      );
      
      console.log(`✅ Datos del foro obtenidos: ${discussionsWithPosts.length} discusiones con posts`);
      
      return {
        forumName,
        discussions: discussionsWithPosts
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo datos del foro:', error);
      throw new Error(`Error al obtener datos del foro: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Realiza el análisis completo de un foro específico
   */
  async analyzeForumComplete(
    forumId: number, 
    forumName: string, 
    courseId: number, 
    userId: string
  ): Promise<AnalysisJobResult> {
    try {
      console.log(`🚀 Iniciando análisis completo del foro ${forumId}...`);
      
      // 1. Obtener datos del foro desde Moodle
      const forumData: ForumData = {
        id: forumId,
        name: forumName,
        intro: 'Foro del curso',
        course: {
          id: courseId,
          name: 'Curso',
          shortname: 'CURSO'
        }
      };
      
      const analysisInput = await this.getForumAnalysisData(forumId, forumName);
      
      if (analysisInput.discussions.length === 0) {
        return {
          success: false,
          error: 'No se encontraron discusiones para analizar en este foro',
          forumData
        };
      }
      
      // 2. Analizar con OpenAI
      console.log('🤖 Enviando datos a OpenAI para análisis...');
      const analysisResult = await openaiClient.analyzeForumContent(analysisInput);
      
      // 3. Guardar resultado en la base de datos
      console.log('💾 Guardando resultado del análisis en la base de datos...');
      const savedAnalysis = await prisma.analysisResult.create({
        data: {
          userId: userId,
          courseId: courseId.toString(),
          groupId: null, // Los foros no siempre tienen grupo específico
          forumId: forumId.toString(),
          analysisType: 'FORUM_PARTICIPATION',
          strengths: analysisResult.insights.map((insight, index) => ({
            id: (index + 1).toString(),
            description: insight,
            evidence: 'Análisis de participación en el foro'
          })),
          alerts: analysisResult.riskStudents && analysisResult.riskStudents.length > 0 ? [
            {
              id: '1',
              description: `Estudiantes con baja participación: ${analysisResult.riskStudents.join(', ')}`,
              severity: 'medium'
            }
          ] : [],
          nextStep: analysisResult.recommendations.join(' '),
          rawData: {
            forumName,
            participationLevel: analysisResult.participationLevel,
            keyTopics: analysisResult.keyTopics,
            discussionsCount: analysisInput.discussions.length,
            totalReplies: analysisInput.discussions.reduce((sum, d) => sum + d.replies.length, 0)
          },
          llmResponse: {
            summary: analysisResult.summary,
            insights: analysisResult.insights,
            recommendations: analysisResult.recommendations,
            engagementScore: analysisResult.engagementScore
          },
          confidence: analysisResult.engagementScore / 100
        }
      });
      
      console.log('✅ Análisis completado y guardado con ID:', savedAnalysis.id);
      
      return {
        success: true,
        analysisId: savedAnalysis.id,
        forumData,
        analysisResult
      };
      
    } catch (error) {
      console.error('❌ Error en análisis completo del foro:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido en el análisis'
      };
    }
  }

  /**
   * Obtiene los análisis previos de un usuario
   */
  async getUserAnalysisHistory(userId: string, limit: number = 10) {
    try {
      const analyses = await prisma.analysisResult.findMany({
        where: {
          userId: userId
        },
        orderBy: {
          processedAt: 'desc'
        },
        take: limit
      });
      
      return analyses.map(analysis => ({
        id: analysis.id,
        courseId: analysis.courseId,
        analysisType: analysis.analysisType,
        nextStep: analysis.nextStep,
        confidence: analysis.confidence,
        processedAt: analysis.processedAt,
        rawData: analysis.rawData
      }));
    } catch (error) {
      console.error('❌ Error obteniendo historial de análisis:', error);
      return [];
    }
  }

  /**
   * Limpia el contenido HTML de Moodle
   */
  private cleanHtmlContent(htmlContent: string): string {
    // Remover tags HTML básicos y limpiar el contenido
    return htmlContent
      .replace(/<[^>]*>/g, '') // Remover tags HTML
      .replace(/&nbsp;/g, ' ') // Reemplazar espacios no separables
      .replace(/&amp;/g, '&') // Decodificar entidades HTML básicas
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\\s+/g, ' ') // Normalizar espacios
      .trim();
  }

  /**
   * Verifica que todos los servicios estén funcionando
   */
  async healthCheck(): Promise<{
    moodle: boolean;
    openai: boolean;
    database: boolean;
  }> {
    const results = {
      moodle: false,
      openai: false,
      database: false
    };

    try {
      // Test Moodle
      results.moodle = await moodleClient.testConnection();
    } catch (error) {
      console.error('❌ Error en health check de Moodle:', error);
    }

    try {
      // Test OpenAI
      results.openai = await openaiClient.testConnection();
    } catch (error) {
      console.error('❌ Error en health check de OpenAI:', error);
    }

    try {
      // Test Database
      await prisma.$queryRaw`SELECT 1`;
      results.database = true;
    } catch (error) {
      console.error('❌ Error en health check de Database:', error);
    }

    return results;
  }
}

// Exportar instancia singleton
export const forumAnalysisService = new ForumAnalysisService();
