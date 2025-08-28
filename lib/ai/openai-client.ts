import OpenAI from 'openai';

export interface AnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
  participationLevel: 'Alto' | 'Medio' | 'Bajo';
  engagementScore: number; // 0-100
  keyTopics: string[];
  riskStudents?: string[];
  metricsTable?: string;
  structuredInsights?: {
    numbered?: string[];
    bullets?: string[];
  };
}

export interface ForumAnalysisInput {
  forumName: string;
  discussions: Array<{
    title: string;
    author: string;
    content: string;
    replies: Array<{
      author: string;
      content: string;
      timestamp: string;
    }>;
    timestamp: string;
  }>;
}

class OpenAIClient {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY no está configurado en las variables de entorno');
      }

      this.client = new OpenAI({
        apiKey: apiKey,
      });
    }
    
    return this.client;
  }

  /**
   * Analiza un foro completo con sus discusiones y respuestas
   */
  async analyzeForumContent(input: ForumAnalysisInput): Promise<AnalysisResult> {
    try {
      console.log(`🤖 Analizando foro: ${input.forumName} con ${input.discussions.length} discusiones...`);

      const prompt = this.buildAnalysisPrompt(input);

      const completion = await this.getClient().chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "Eres un experto analista educativo especializado en análisis de participación estudiantil en foros académicos. Tu tarea es analizar las discusiones de foros educativos y proporcionar insights valiosos para profesores."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3, // Respuestas más consistentes
        max_tokens: 2000,
      });

      const response = completion.choices[0].message.content;
      
      if (!response) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      return this.parseAnalysisResponse(response);

    } catch (error) {
      console.error('❌ Error en análisis de OpenAI:', error);
      throw new Error(`Error al analizar con OpenAI: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Construye el prompt para el análisis del foro
   */
  private buildAnalysisPrompt(input: ForumAnalysisInput): string {
    const discussionsText = input.discussions.map(disc => {
      const repliesText = disc.replies.map(reply => 
        `    RESPUESTA de ${reply.author} (${reply.timestamp}):\n    ${reply.content}`
      ).join('\n\n');

      return `DISCUSIÓN: "${disc.title}"
Autor: ${disc.author}
Fecha: ${disc.timestamp}
Contenido: ${disc.content}

${repliesText ? 'RESPUESTAS:\n' + repliesText : 'Sin respuestas'}`;
    }).join('\n\n' + '='.repeat(80) + '\n\n');

    return `Analiza el siguiente foro académico del curso "${input.forumName}":

${discussionsText}

Por favor, proporciona un análisis estructurado en formato JSON con los siguientes campos:

{
  "summary": "Resumen general del foro (máximo 200 palabras)",
  "insights": ["Insight 1", "Insight 2", "Insight 3"], // máximo 5 insights
  "recommendations": ["Recomendación 1", "Recomendación 2"], // máximo 4 recomendaciones
  "participationLevel": "Alto|Medio|Bajo", // basado en cantidad y calidad de participaciones
  "engagementScore": 85, // número entre 0-100 basado en la calidad de interacciones
  "keyTopics": ["Tema 1", "Tema 2", "Tema 3"], // máximo 5 temas principales
  "riskStudents": ["Estudiante 1", "Estudiante 2"], // estudiantes con baja participación (opcional)
  "metricsTable": "Indicador | Valor observado\nMensajes totales | 45\nParticipantes únicos | 12\nPromedio de intervenciones por estudiante | 2.6\nRespuestas con réplicas sustantivas | 71%\nEntradas con cita y referencia en formato APA | 43%", // tabla de métricas cuando sea apropiado
  "structuredInsights": {
    "numbered": ["1. Dominio conceptual básico logrado: Todos los participantes pueden enumerar las 4-5 funciones administrativas y diferencian eficacia/eficiencia; evidencia de logro del OE1 de la unidad.", "2. Análisis crítico emergente: 60% de los estudiantes demuestran capacidad para relacionar teoría con casos prácticos."],
    "bullets": ["• Alta participación inicial que decrece hacia el final", "• Uso efectivo de referencias académicas", "• Buena interacción entre pares"]
  }
}

INSTRUCCIONES ESPECIALES PARA PRESENTACIÓN VISUAL:
- Si tienes datos cuantitativos (números, porcentajes, conteos), incluye una tabla en "metricsTable" usando formato "Indicador | Valor"
- Para insights complejos que requieren numeración, usa "structuredInsights.numbered" 
- Para puntos clave que no requieren orden específico, usa "structuredInsights.bullets"
- El campo "insights" mantenlo para compatibilidad, pero prioriza "structuredInsights" cuando sea apropiado

Considera en tu análisis:
- Nivel de participación de los estudiantes
- Calidad y profundidad de las discusiones
- Interacciones entre estudiantes
- Temas o conceptos más discutidos
- Identificación de estudiantes que necesitan más apoyo
- Sugerencias pedagógicas para mejorar la participación

Responde ÚNICAMENTE con el JSON, sin texto adicional.`;
  }

  /**
   * Parsea la respuesta de OpenAI y la convierte en un objeto estructurado
   */
  private parseAnalysisResponse(response: string): AnalysisResult {
    try {
      // Limpiar la respuesta por si viene con texto adicional
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;

      const parsed = JSON.parse(jsonString);

      // Validar y normalizar la respuesta
      return {
        summary: parsed.summary || 'No se pudo generar resumen',
        insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 5) : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 4) : [],
        participationLevel: ['Alto', 'Medio', 'Bajo'].includes(parsed.participationLevel) 
          ? parsed.participationLevel 
          : 'Medio',
        engagementScore: typeof parsed.engagementScore === 'number' 
          ? Math.min(100, Math.max(0, parsed.engagementScore))
          : 50,
        keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics.slice(0, 5) : [],
        riskStudents: Array.isArray(parsed.riskStudents) ? parsed.riskStudents : undefined,
        metricsTable: parsed.metricsTable || undefined,
        structuredInsights: parsed.structuredInsights || undefined,
      };
    } catch (error) {
      console.error('❌ Error parseando respuesta de OpenAI:', error);
      console.log('Respuesta recibida:', response);
      
      // Fallback: devolver estructura básica
      return {
        summary: 'Error al procesar el análisis. Por favor, intente nuevamente.',
        insights: ['Error en el procesamiento del análisis'],
        recommendations: ['Revisar manualmente el contenido del foro'],
        participationLevel: 'Medio',
        engagementScore: 0,
        keyTopics: [],
      };
    }
  }

  /**
   * Verifica la conexión con OpenAI
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Verificando conexión con OpenAI...');
      
      const completion = await this.getClient().chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "user",
            content: "Responde únicamente 'OK' para confirmar que la conexión funciona."
          }
        ],
        max_tokens: 10,
      });

      const response = completion.choices[0].message.content?.trim();
      
      if (response === 'OK') {
        console.log('✅ Conexión con OpenAI exitosa');
        return true;
      } else {
        console.log('⚠️ Respuesta inesperada de OpenAI:', response);
        return false;
      }
    } catch (error) {
      console.error('❌ Error conectando con OpenAI:', error);
      return false;
    }
  }
}

// Exportar instancia singleton
export const openaiClient = new OpenAIClient();
