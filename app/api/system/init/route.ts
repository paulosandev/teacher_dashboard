import { NextRequest, NextResponse } from 'next/server'
import { initializeWorkers, areWorkersRunning, getWorkersInfo } from '@/lib/init-workers'

export async function POST(req: NextRequest) {
  try {
    if (areWorkersRunning()) {
      return NextResponse.json({
        success: true,
        message: 'Workers ya están ejecutándose',
        info: getWorkersInfo()
      })
    }

    await initializeWorkers()
    
    return NextResponse.json({
      success: true,
      message: 'Workers inicializados correctamente',
      info: getWorkersInfo()
    })

  } catch (error) {
    console.error('❌ Error inicializando workers:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
      info: getWorkersInfo()
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      workers: getWorkersInfo()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}