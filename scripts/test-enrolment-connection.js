/**
 * Script de prueba para verificar la conexión a la base de datos de enrolment
 * Ejecutar con: node scripts/test-enrolment-connection.js
 */

const mysql = require('mysql2/promise');
const { createTunnel } = require('tunnel-ssh');
const fs = require('fs');

async function testConnection() {
  let tunnel = null;
  let connection = null;

  try {
    console.log('🔐 Iniciando conexión SSH...');
    
    // Leer la clave privada
    const privateKey = fs.readFileSync('/Users/paulocesarsanchezespindola/Downloads/status-services-v2 3 1.pem');
    
    // Configuración del túnel
    const tunnelOptions = {
      autoClose: true
    };
    
    const serverOptions = {
      host: '127.0.0.1',
      port: 33061
    };
    
    const sshOptions = {
      host: '44.233.107.237',
      port: 22,
      username: 'ec2-user',
      privateKey: privateKey
    };
    
    const forwardOptions = {
      srcAddr: '127.0.0.1',
      srcPort: 33061,
      dstAddr: 'wsdata.ce9oduyxts26.us-west-1.rds.amazonaws.com',
      dstPort: 3306
    };

    // Crear el túnel SSH
    const [server, conn] = await createTunnel(
      tunnelOptions,
      serverOptions,
      sshOptions,
      forwardOptions
    );
    
    tunnel = { server, conn };
    console.log('✅ Túnel SSH establecido');
    
    // Conectar a MySQL a través del túnel
    console.log('💾 Conectando a MySQL...');
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 33061,
      user: 'datos',
      password: 'PP7Su9e433aNZP956',
      database: 'heroku_e6e033d354ff64c'
    });
    
    console.log('✅ Conexión MySQL establecida');
    
    // Probar la conexión con una consulta simple
    console.log('\n📊 Ejecutando consultas de prueba...\n');
    
    // 1. Verificar estructura de tabla
    console.log('1️⃣ Estructura de la tabla enrolment:');
    const [columns] = await connection.execute('DESCRIBE enrolment');
    columns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type}`);
    });
    
    // 2. Contar registros totales
    console.log('\n2️⃣ Estadísticas generales:');
    const [totalCount] = await connection.execute('SELECT COUNT(*) as total FROM enrolment');
    console.log(`   Total de registros: ${totalCount[0].total}`);
    
    // 3. Contar profesores (role_id = 17)
    const [teacherCount] = await connection.execute(
      'SELECT COUNT(DISTINCT userid) as total FROM enrolment WHERE roles_id = 17 AND suspendido = 0'
    );
    console.log(`   Profesores únicos: ${teacherCount[0].total}`);
    
    // 4. Obtener aulas únicas
    const [aulas] = await connection.execute('SELECT DISTINCT idAula FROM enrolment WHERE idAula IS NOT NULL LIMIT 10');
    console.log(`   Aulas únicas (primeras 10): ${aulas.map(a => a.idAula).join(', ')}`);
    
    // 5. Obtener algunos registros de ejemplo
    console.log('\n3️⃣ Registros de ejemplo (primeros 5 profesores):');
    const [sampleRecords] = await connection.execute(`
      SELECT 
        userid,
        username,
        firstname,
        lastname,
        email,
        idAula,
        fullname as course_name,
        groups_name
      FROM enrolment 
      WHERE roles_id = 17 
      AND suspendido = 0
      LIMIT 5
    `);
    
    sampleRecords.forEach((record, index) => {
      console.log(`\n   Profesor ${index + 1}:`);
      console.log(`   - UserID: ${record.userid}`);
      console.log(`   - Nombre: ${record.firstname} ${record.lastname}`);
      console.log(`   - Email: ${record.email}`);
      console.log(`   - Aula: ${record.idAula}`);
      console.log(`   - Curso: ${record.course_name}`);
      console.log(`   - Grupo: ${record.groups_name}`);
    });
    
    // 6. Probar construcción de URLs de aula
    console.log('\n4️⃣ URLs de aulas construidas:');
    const [distinctAulas] = await connection.execute('SELECT DISTINCT idAula FROM enrolment WHERE idAula IS NOT NULL LIMIT 5');
    distinctAulas.forEach(aula => {
      const aulaId = aula.idAula;
      let url = '';
      if (/^\d+$/.test(aulaId)) {
        url = `https://aula${aulaId}.utel.edu.mx`;
      } else {
        url = `https://${aulaId.toLowerCase()}.utel.edu.mx`;
      }
      console.log(`   ${aulaId} -> ${url}`);
    });
    
    console.log('\n✅ Prueba completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    // Cerrar conexiones
    if (connection) {
      await connection.end();
      console.log('\n🔒 Conexión MySQL cerrada');
    }
    
    if (tunnel) {
      if (tunnel.server) tunnel.server.close();
      if (tunnel.conn) tunnel.conn.end();
      console.log('🔒 Túnel SSH cerrado');
    }
    
    process.exit(0);
  }
}

// Ejecutar la prueba
testConnection();