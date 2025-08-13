#!/usr/bin/env npx tsx

/**
 * Script para actualizar las matrículas de los usuarios a las correctas de Moodle
 */

import dotenv from 'dotenv'
import path from 'path'
import { prisma } from '../lib/db/prisma'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function updateMatriculas() {
  console.log('🔧 ACTUALIZANDO MATRÍCULAS DE USUARIOS')
  console.log('='.repeat(60))
  
  // Actualizar matrícula de Paulo
  const pauloUser = await prisma.user.findFirst({
    where: {
      email: 'mail.paulo@gmail.com'
    }
  })
  
  if (pauloUser) {
    await prisma.user.update({
      where: { id: pauloUser.id },
      data: { matricula: 'paulo.cesar' }
    })
    console.log('✅ Matrícula de Paulo actualizada: ADMIN001 → paulo.cesar')
  }
  
  // Actualizar matrícula de César
  const cesarUser = await prisma.user.findFirst({
    where: {
      email: 'cesar.espindola@utel.edu.mx'
    }
  })
  
  if (cesarUser) {
    await prisma.user.update({
      where: { id: cesarUser.id },
      data: { matricula: 'cesar.espindola' }
    })
    console.log('✅ Matrícula de César actualizada: PROF001 → cesar.espindola')
  }
  
  console.log('\n🎯 CREDENCIALES ACTUALIZADAS PARA LOGIN')
  console.log('='.repeat(60))
  console.log('Usuario 1:')
  console.log('📧 Email: mail.paulo@gmail.com')
  console.log('🔑 Password: admin1234')
  console.log('🆔 Matrícula: paulo.cesar')
  console.log('')
  console.log('Usuario 2:')
  console.log('📧 Email: cesar.espindola@utel.edu.mx')
  console.log('🔑 Password: admin1234')
  console.log('🆔 Matrícula: cesar.espindola')
  console.log('')
  console.log('✅ Las matrículas ahora corresponden a usuarios reales de Moodle')
}

// Ejecutar
updateMatriculas()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
