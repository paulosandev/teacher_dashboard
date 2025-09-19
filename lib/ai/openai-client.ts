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
  markdownAnalysis?: string; // Nueva propiedad para análisis en markdown
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
            role: "user",
            content: this.buildEducationalAnalysisPrompt(input)
          }
        ],
        max_completion_tokens: 4000,
      });

      const response = completion.choices[0].message.content;

      if (!response) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      return this.parseEducationalAnalysisResponse(response);

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
   * Construye el prompt educacional mejorado para análisis de foros
   */
  private buildEducationalAnalysisPrompt(input: ForumAnalysisInput): string {
    const discussionsData = input.discussions.map(disc => ({
      title: disc.title,
      author: disc.author,
      content: disc.content,
      timestamp: disc.timestamp,
      replies: disc.replies.map(reply => ({
        author: reply.author,
        content: reply.content,
        timestamp: reply.timestamp
      }))
    }));

    return `
Eres un asistente del profesor en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables que contribuyan al cumplimiento de los objetivos del curso acerca del comportamiento de sus estudiantes dentro de las actividades en el foro de discusión. El propósito es que, aunque el profesor no participa directamente en la dinámica del foro, pueda mantener una visión clara de lo que ocurre en él y, en caso necesario, intervenga de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass).

- Redacta con un estilo conversacional dirigido al profesor de quien eres asistente, utilizando el principio de minto pyramid (no menciones que estás redactando utilizando este principio) donde la conclusión son los insights accionales.
- El análisis debe estructurarse en al menos 5 dimensiones. Cada dimensión debe presentarse con el formato siguiente:
  #### [Nombre de la dimensión]
  * Incluye hallazgos clave en viñetas, redactados de forma breve y clara.
  * Cada hallazgo debe resaltar con negritas los elementos relevantes.
  **Acción sugerida:** redactar una recomendación específica, breve y accionable para el profesor.
- Ordena las dimensiones de mayor a menor impacto.
- El formato de entrega solo es markdown.
- El análisis debe limitarse únicamente al reporte solicitado, sin incluir preguntas, sugerencias adicionales, invitaciones a continuar ni ofertas de recursos complementarios.
- El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.
- Simpre incluye insights accionables acerca de nivel de participación y si surgen dudas o temas de conversación fuera de la consigna de la discusión.

${JSON.stringify(discussionsData, null, 2)}`;
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
   * Parsea la respuesta de análisis educacional en markdown
   */
  private parseEducationalAnalysisResponse(response: string): AnalysisResult {
    try {
      // Extraer información básica del markdown para mantener compatibilidad
      const dimensions = response.split('####').filter(section => section.trim().length > 0);

      // Extraer insights de las viñetas
      const insights: string[] = [];
      const recommendations: string[] = [];

      dimensions.forEach(dimension => {
        const bulletPoints = dimension.match(/\* ([^*]+?)(?=\*|$)/g);
        const actionSuggestion = dimension.match(/\*\*Acción sugerida:\*\* (.+?)(?=\n|$)/);

        if (bulletPoints) {
          bulletPoints.forEach(bullet => {
            const cleanBullet = bullet.replace(/^\* /, '').trim();
            if (cleanBullet) insights.push(cleanBullet);
          });
        }

        if (actionSuggestion) {
          recommendations.push(actionSuggestion[1].trim());
        }
      });

      return {
        summary: 'Análisis educacional completado - ver markdownAnalysis para detalles completos',
        insights: insights.slice(0, 5), // Limitar a 5 insights
        recommendations: recommendations.slice(0, 4), // Limitar a 4 recomendaciones
        participationLevel: this.extractParticipationLevel(response),
        engagementScore: this.extractEngagementScore(response),
        keyTopics: this.extractKeyTopics(response),
        markdownAnalysis: response // Guardamos la respuesta completa en markdown
      };
    } catch (error) {
      console.error('❌ Error parseando respuesta educacional:', error);
      console.log('Respuesta recibida:', response);

      // Fallback: devolver estructura básica con markdown
      return {
        summary: 'Error al procesar el análisis educacional. Ver markdownAnalysis para contenido bruto.',
        insights: ['Error en el procesamiento del análisis'],
        recommendations: ['Revisar manualmente el contenido del foro'],
        participationLevel: 'Medio',
        engagementScore: 0,
        keyTopics: [],
        markdownAnalysis: response // Guardar respuesta original aunque haya error
      };
    }
  }

  /**
   * Extrae el nivel de participación del análisis markdown
   */
  private extractParticipationLevel(response: string): 'Alto' | 'Medio' | 'Bajo' {
    const lowerResponse = response.toLowerCase();
    if (lowerResponse.includes('participación alta') || lowerResponse.includes('alto nivel')) return 'Alto';
    if (lowerResponse.includes('participación baja') || lowerResponse.includes('bajo nivel')) return 'Bajo';
    return 'Medio';
  }

  /**
   * Extrae el score de engagement del análisis markdown
   */
  private extractEngagementScore(response: string): number {
    const percentageMatch = response.match(/(\d+)%/);
    if (percentageMatch) {
      return parseInt(percentageMatch[1]);
    }
    return 50; // Score por defecto
  }

  /**
   * Extrae temas clave del análisis markdown
   */
  private extractKeyTopics(response: string): string[] {
    const topics: string[] = [];
    const dimensionHeaders = response.match(/#### ([^\n]+)/g);

    if (dimensionHeaders) {
      dimensionHeaders.forEach(header => {
        const topic = header.replace('#### ', '').trim();
        if (topic) topics.push(topic);
      });
    }

    return topics.slice(0, 5); // Limitar a 5 temas
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
        max_completion_tokens: 10,
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
