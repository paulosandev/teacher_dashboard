#!/usr/bin/env npx tsx
/**
 * Script para verificar qué actividades tenemos disponibles para probar
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verificando actividades disponibles para pruebas')

  try {
    // 1. Verificar actividades en CourseActivity
    const activities = await prisma.courseActivity.findMany({
      select: {
        id: true,
        aulaId: true,
        courseId: true,
        name: true,
        type: true,
        needsAnalysis: true,
        visible: true,
        lastDataSync: true
      },
      orderBy: [
        { aulaId: 'asc' },
        { courseId: 'asc' },
        { name: 'asc' }
      ]
    })

    console.log(`📊 Total actividades en CourseActivity: ${activities.length}`)

    // Agrupar por aula
    const byAula = activities.reduce((acc: any, activity) => {
      if (!acc[activity.aulaId]) {
        acc[activity.aulaId] = []
      }
      acc[activity.aulaId].push(activity)
      return acc
    }, {})

    console.log('\n📋 Actividades por aula:')
    Object.keys(byAula).sort().forEach(aulaId => {
      const aulaActivities = byAula[aulaId]
      const forums = aulaActivities.filter((a: any) => a.type === 'forum')
      const assignments = aulaActivities.filter((a: any) => a.type === 'assign')
      const needAnalysis = aulaActivities.filter((a: any) => a.needsAnalysis)

      console.log(`\n🏫 Aula ${aulaId}:`)
      console.log(`   Total: ${aulaActivities.length} actividades`)
      console.log(`   Foros: ${forums.length}`)
      console.log(`   Tareas: ${assignments.length}`)
      console.log(`   Necesitan análisis: ${needAnalysis.length}`)

      if (aulaActivities.length > 0) {
        console.log(`   Últimos cursos: ${[...new Set(aulaActivities.map((a: any) => a.courseId))].join(', ')}`)
      }
    })

    // 2. Verificar análisis existentes
    const analyses = await prisma.activityAnalysis.findMany({
      select: {
        courseId: true,
        activityType: true,
        activityName: true,
        generatedAt: true,
        isValid: true
      },
      orderBy: {
        generatedAt: 'desc'
      },
      take: 20
    })

    console.log(`\n📊 Análisis existentes: ${analyses.length} (últimos 20)`)
    if (analyses.length > 0) {
      console.log('\n🔍 Últimos análisis:')
      analyses.forEach((analysis, i) => {
        console.log(`${i + 1}. ${analysis.courseId} - ${analysis.activityName} (${analysis.activityType}) - ${analysis.generatedAt?.toLocaleDateString('es-ES')}`)
      })
    }

    // 3. Buscar actividades específicas para pruebas
    const testCandidates = activities.filter(a =>
      a.needsAnalysis &&
      a.visible &&
      (a.type === 'forum' || a.type === 'assign')
    )

    console.log(`\n🎯 Candidatos para pruebas (needsAnalysis + visible): ${testCandidates.length}`)
    if (testCandidates.length > 0) {
      console.log('\n📝 Mejores candidatos para probar:')
      testCandidates.slice(0, 10).forEach((activity, i) => {
        console.log(`${i + 1}. ${activity.aulaId}-${activity.courseId} - ${activity.name} (${activity.type})`)
      })
    }

    // 4. Verificar si hay actividades de aula 101 específicamente
    const aula101Activities = activities.filter(a => a.aulaId === '101')
    console.log(`\n🏫 Actividades específicas de Aula 101: ${aula101Activities.length}`)
    if (aula101Activities.length > 0) {
      aula101Activities.forEach((activity, i) => {
        console.log(`${i + 1}. Curso ${activity.courseId} - ${activity.name} (${activity.type}) - Análisis: ${activity.needsAnalysis ? 'SÍ' : 'NO'}`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)