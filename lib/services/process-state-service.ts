/**
 * Servicio de Estado de Procesos Compartido
 * Mantiene el estado de los procesos batch en un archivo JSON
 * para que sea accesible desde cualquier instancia/proceso
 */

import fs from 'fs/promises'
import path from 'path'

export interface ProcessState {
  isActive: boolean
  processType: 'cron' | 'manual' | null
  startTime: string | null
  currentStep: string | null
  totalAulas: number
  processedAulas: number
  totalCourses: number
  processedCourses: number
  totalAnalysis: number
  processedAnalysis: number
  currentAula: string | null
  errors: string[]
  lastUpdate: string
  estimatedCompletion: string | null
}

export class ProcessStateService {
  private static instance: ProcessStateService
  private stateFilePath: string
  
  constructor() {
    this.stateFilePath = path.join(process.cwd(), '.cache', 'process-state.json')
  }

  static getInstance(): ProcessStateService {
    if (!this.instance) {
      this.instance = new ProcessStateService()
    }
    return this.instance
  }

  /**
   * Asegurar que el directorio .cache existe
   */
  private async ensureCacheDir(): Promise<void> {
    const cacheDir = path.dirname(this.stateFilePath)
    try {
      await fs.access(cacheDir)
    } catch {
      await fs.mkdir(cacheDir, { recursive: true })
    }
  }

  /**
   * Inicializar proceso
   */
  async initProcess(type: 'cron' | 'manual', totalAulas: number): Promise<void> {
    await this.ensureCacheDir()
    
    const state: ProcessState = {
      isActive: true,
      processType: type,
      startTime: new Date().toISOString(),
      currentStep: 'Iniciando proceso',
      totalAulas,
      processedAulas: 0,
      totalCourses: 0,
      processedCourses: 0,
      totalAnalysis: 0,
      processedAnalysis: 0,
      currentAula: null,
      errors: [],
      lastUpdate: new Date().toISOString(),
      estimatedCompletion: null
    }

    await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2))
  }

  /**
   * Actualizar progreso del proceso
   */
  async updateProgress(updates: Partial<ProcessState>): Promise<void> {
    try {
      const currentState = await this.getState()
      const updatedState: ProcessState = {
        ...currentState,
        ...updates,
        lastUpdate: new Date().toISOString()
      }

      // Calcular tiempo estimado de finalización
      if (updatedState.processedAulas > 0 && updatedState.totalAulas > 0) {
        const elapsed = new Date().getTime() - new Date(updatedState.startTime!).getTime()
        const avgTimePerAula = elapsed / updatedState.processedAulas
        const remainingAulas = updatedState.totalAulas - updatedState.processedAulas
        const estimatedRemainingTime = remainingAulas * avgTimePerAula
        updatedState.estimatedCompletion = new Date(Date.now() + estimatedRemainingTime).toISOString()
      }

      await fs.writeFile(this.stateFilePath, JSON.stringify(updatedState, null, 2))
    } catch (error) {
      console.error('Error actualizando estado del proceso:', error)
    }
  }

  /**
   * Finalizar proceso
   */
  async finishProcess(success: boolean, finalMessage?: string): Promise<void> {
    try {
      const currentState = await this.getState()
      const updatedState: ProcessState = {
        ...currentState,
        isActive: false,
        currentStep: success ? 'Proceso completado exitosamente' : `Proceso terminado: ${finalMessage}`,
        lastUpdate: new Date().toISOString(),
        estimatedCompletion: null
      }

      await fs.writeFile(this.stateFilePath, JSON.stringify(updatedState, null, 2))
    } catch (error) {
      console.error('Error finalizando estado del proceso:', error)
    }
  }

  /**
   * Obtener estado actual
   */
  async getState(): Promise<ProcessState> {
    try {
      await this.ensureCacheDir()
      const content = await fs.readFile(this.stateFilePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      // Si no existe el archivo, devolver estado inicial
      return {
        isActive: false,
        processType: null,
        startTime: null,
        currentStep: 'Sistema inactivo',
        totalAulas: 0,
        processedAulas: 0,
        totalCourses: 0,
        processedCourses: 0,
        totalAnalysis: 0,
        processedAnalysis: 0,
        currentAula: null,
        errors: [],
        lastUpdate: new Date().toISOString(),
        estimatedCompletion: null
      }
    }
  }

  /**
   * Agregar error al estado
   */
  async addError(error: string): Promise<void> {
    const currentState = await this.getState()
    currentState.errors.push(`${new Date().toISOString()}: ${error}`)
    // Mantener solo los últimos 10 errores
    if (currentState.errors.length > 10) {
      currentState.errors = currentState.errors.slice(-10)
    }
    await this.updateProgress({ errors: currentState.errors })
  }

  /**
   * Obtener progreso como porcentaje
   */
  async getProgressPercentage(): Promise<number> {
    const state = await this.getState()
    if (!state.isActive || state.totalAulas === 0) return 0
    return Math.round((state.processedAulas / state.totalAulas) * 100)
  }

  /**
   * Obtener tiempo transcurrido
   */
  async getElapsedTime(): Promise<string> {
    const state = await this.getState()
    if (!state.startTime) return 'N/A'
    
    const elapsed = Date.now() - new Date(state.startTime).getTime()
    const minutes = Math.floor(elapsed / (1000 * 60))
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000)
    
    return `${minutes}m ${seconds}s`
  }
}

// Exportar singleton
export const processStateService = ProcessStateService.getInstance()