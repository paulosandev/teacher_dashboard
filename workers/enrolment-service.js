/**
 * Servicio Worker para manejar conexiones SSH y consultas a base de datos de enrolments
 * Este servicio corre independiente de Next.js para evitar problemas con webpack
 * 
 * Ejecutar con: node workers/enrolment-service.js
 */

const express = require('express');
const mysql = require('mysql2/promise');
const { createTunnel } = require('tunnel-ssh');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.ENROLMENT_SERVICE_PORT || 3002;

let tunnel = null;
let connection = null;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de la conexión
const CONFIG = {
  ssh: {
    host: '44.233.107.237',
    port: 22,
    username: 'ec2-user',
    privateKeyPath: '/Users/paulocesarsanchezespindola/Downloads/status-services-v2 3 1.pem'
  },
  database: {
    host: 'wsdata.ce9oduyxts26.us-west-1.rds.amazonaws.com',
    port: 3306,
    user: 'datos',
    password: 'PP7Su9e433aNZP956',
    database: 'heroku_e6e033d354ff64c'
  },
  localPort: 33061
};

const TEACHER_ROLE_ID = 17;

/**
 * Construir URL del aula basado en idAula
 */
function buildAulaUrl(idAula) {
  if (!idAula) return '';
  
  // Si el idAula contiene solo números (ej: 101, 102)
  if (/^\d+$/.test(idAula)) {
    return `https://aula${idAula}.utel.edu.mx`;
  }
  
  // Si el idAula contiene letras (ej: av141, av142)
  return `https://${idAula.toLowerCase()}.utel.edu.mx`;
}

/**
 * Establecer conexión SSH y MySQL
 */
async function establishConnection() {
  try {
    console.log('🔐 Estableciendo conexión SSH...');
    
    // Leer la clave privada
    const privateKey = fs.readFileSync(CONFIG.ssh.privateKeyPath);
    
    // Configuración del túnel
    const tunnelOptions = { autoClose: true };
    const serverOptions = { host: '127.0.0.1', port: CONFIG.localPort };
    const sshOptions = {
      host: CONFIG.ssh.host,
      port: CONFIG.ssh.port,
      username: CONFIG.ssh.username,
      privateKey: privateKey
    };
    const forwardOptions = {
      srcAddr: '127.0.0.1',
      srcPort: CONFIG.localPort,
      dstAddr: CONFIG.database.host,
      dstPort: CONFIG.database.port
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
    
    // Conectar a MySQL
    console.log('💾 Conectando a MySQL...');
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: CONFIG.localPort,
      user: CONFIG.database.user,
      password: CONFIG.database.password,
      database: CONFIG.database.database
    });
    
    console.log('✅ Conexión MySQL establecida');
    return true;
    
  } catch (error) {
    console.error('❌ Error estableciendo conexión:', error);
    return false;
  }
}

/**
 * Verificar y reconectar si es necesario
 */
async function ensureConnection() {
  try {
    if (!connection) {
      return await establishConnection();
    }
    
    // Verificar que la conexión esté activa
    await connection.ping();
    return true;
    
  } catch (error) {
    console.log('🔄 Reconectando...');
    return await establishConnection();
  }
}

// ================= ENDPOINTS =================

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'enrolment-service',
    connected: connection !== null,
    timestamp: new Date().toISOString()
  });
});

/**
 * Obtener enrolments por email
 */
app.get('/enrolments/by-email/:email', async (req, res) => {
  try {
    await ensureConnection();
    
    const { email } = req.params;
    console.log(`📧 Consultando enrolments para: ${email}`);
    
    const [results] = await connection.execute(`
      SELECT 
        userid,
        username,
        firstname,
        lastname,
        email,
        courseid,
        fullname as course_name,
        courseshortname,
        idAula,
        groupid,
        groups_name,
        roles_id,
        roles_shortname,
        suspendido
      FROM enrolment 
      WHERE LOWER(email) = LOWER(?) 
      AND roles_id = ?
      AND suspendido = 0
      ORDER BY idAula, fullname
    `, [email, TEACHER_ROLE_ID]);
    
    // Procesar y agrupar por aula
    const processedResults = results.map(record => ({
      userId: record.userid,
      userName: record.username,
      userFullName: `${record.firstname} ${record.lastname}`.trim(),
      email: record.email,
      aulaId: record.idAula,
      aulaUrl: buildAulaUrl(record.idAula),
      courseId: record.courseid,
      courseName: record.course_name,
      courseShortName: record.courseshortname,
      groupId: record.groupid,
      groupName: record.groups_name,
      roleId: record.roles_id,
      roleName: record.roles_shortname,
      isTeacher: record.roles_id == TEACHER_ROLE_ID
    }));
    
    // Agrupar por aula
    const enrolmentsByAula = {};
    processedResults.forEach(enr => {
      if (!enrolmentsByAula[enr.aulaId]) {
        enrolmentsByAula[enr.aulaId] = {
          aulaId: enr.aulaId,
          aulaUrl: enr.aulaUrl,
          courses: []
        };
      }
      
      enrolmentsByAula[enr.aulaId].courses.push({
        courseId: enr.courseId,
        courseName: enr.courseName,
        courseShortName: enr.courseShortName,
        groupId: enr.groupId,
        groupName: enr.groupName
      });
    });
    
    // Obtener aulas únicas
    const uniqueAulas = Object.keys(enrolmentsByAula).map(aulaId => ({
      aulaId,
      aulaUrl: buildAulaUrl(aulaId),
      coursesCount: enrolmentsByAula[aulaId].courses.length
    }));
    
    res.json({
      success: true,
      email,
      totalEnrolments: processedResults.length,
      aulasCount: uniqueAulas.length,
      aulas: uniqueAulas,
      enrolmentsByAula: Object.values(enrolmentsByAula),
      rawEnrolments: processedResults
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtener enrolments por userId
 */
app.get('/enrolments/by-userid/:userId', async (req, res) => {
  try {
    await ensureConnection();
    
    const { userId } = req.params;
    console.log(`🔍 Consultando enrolments para userId: ${userId}`);
    
    const [results] = await connection.execute(`
      SELECT 
        userid,
        username,
        firstname,
        lastname,
        email,
        courseid,
        fullname as course_name,
        courseshortname,
        idAula,
        groupid,
        groups_name,
        roles_id,
        roles_shortname,
        suspendido
      FROM enrolment 
      WHERE userid = ? 
      AND roles_id = ?
      AND suspendido = 0
      ORDER BY idAula, fullname
    `, [userId, TEACHER_ROLE_ID]);
    
    // Procesar resultados igual que con email
    const processedResults = results.map(record => ({
      userId: record.userid,
      userName: record.username,
      userFullName: `${record.firstname} ${record.lastname}`.trim(),
      email: record.email,
      aulaId: record.idAula,
      aulaUrl: buildAulaUrl(record.idAula),
      courseId: record.courseid,
      courseName: record.course_name,
      courseShortName: record.courseshortname,
      groupId: record.groupid,
      groupName: record.groups_name,
      roleId: record.roles_id,
      roleName: record.roles_shortname,
      isTeacher: record.roles_id == TEACHER_ROLE_ID
    }));
    
    // Obtener aulas únicas
    const uniqueAulaIds = [...new Set(processedResults.map(r => r.aulaId))];
    const aulas = uniqueAulaIds.map(aulaId => ({
      aulaId,
      aulaUrl: buildAulaUrl(aulaId),
      coursesCount: processedResults.filter(r => r.aulaId === aulaId).length
    }));
    
    res.json({
      success: true,
      userId,
      totalEnrolments: processedResults.length,
      aulasCount: aulas.length,
      aulas,
      enrolments: processedResults
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtener estadísticas generales
 */
app.get('/enrolments/stats', async (req, res) => {
  try {
    await ensureConnection();
    
    console.log('📊 Obteniendo estadísticas...');
    
    // Total de registros
    const [totalCount] = await connection.execute('SELECT COUNT(*) as total FROM enrolment');
    
    // Total de profesores
    const [teacherCount] = await connection.execute(
      'SELECT COUNT(DISTINCT userid) as total FROM enrolment WHERE roles_id = ? AND suspendido = 0',
      [TEACHER_ROLE_ID]
    );
    
    // Aulas únicas
    const [aulas] = await connection.execute('SELECT DISTINCT idAula FROM enrolment WHERE idAula IS NOT NULL');
    
    // Top 10 profesores con más cursos
    const [topTeachers] = await connection.execute(`
      SELECT 
        userid,
        username,
        firstname,
        lastname,
        email,
        COUNT(DISTINCT courseid) as courses_count,
        COUNT(DISTINCT idAula) as aulas_count
      FROM enrolment 
      WHERE roles_id = ? 
      AND suspendido = 0
      GROUP BY userid, username, firstname, lastname, email
      ORDER BY courses_count DESC
      LIMIT 10
    `, [TEACHER_ROLE_ID]);
    
    res.json({
      success: true,
      stats: {
        totalRecords: totalCount[0].total,
        totalTeachers: teacherCount[0].total,
        uniqueAulas: aulas.map(a => ({
          aulaId: a.idAula,
          aulaUrl: buildAulaUrl(a.idAula)
        })),
        topTeachers: topTeachers.map(t => ({
          userId: t.userid,
          userName: t.username,
          fullName: `${t.firstname} ${t.lastname}`.trim(),
          email: t.email,
          coursesCount: t.courses_count,
          aulasCount: t.aulas_count
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Verificar si un email es profesor
 */
app.get('/enrolments/check-teacher/:email', async (req, res) => {
  try {
    await ensureConnection();
    
    const { email } = req.params;
    console.log(`🔍 Verificando si ${email} es profesor...`);
    
    const [results] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT userid) as count,
        MIN(userid) as userId,
        MIN(username) as userName,
        MIN(firstname) as firstName,
        MIN(lastname) as lastName
      FROM enrolment 
      WHERE LOWER(email) = LOWER(?) 
      AND roles_id = ?
      AND suspendido = 0
    `, [email, TEACHER_ROLE_ID]);
    
    const isTeacher = results[0].count > 0;
    
    res.json({
      success: true,
      email,
      isTeacher,
      userData: isTeacher ? {
        userId: results[0].userId,
        userName: results[0].userName,
        firstName: results[0].firstName,
        lastName: results[0].lastName,
        fullName: `${results[0].firstName} ${results[0].lastName}`.trim()
      } : null
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================= SERVIDOR =================

/**
 * Iniciar servidor
 */
async function startServer() {
  try {
    // Establecer conexión inicial
    const connected = await establishConnection();
    
    if (!connected) {
      console.error('❌ No se pudo establecer conexión inicial');
      process.exit(1);
    }
    
    // Iniciar servidor Express
    app.listen(PORT, () => {
      console.log(`🚀 Servicio de enrolments corriendo en http://localhost:${PORT}`);
      console.log('📍 Endpoints disponibles:');
      console.log(`   - GET /health`);
      console.log(`   - GET /enrolments/by-email/:email`);
      console.log(`   - GET /enrolments/by-userid/:userId`);
      console.log(`   - GET /enrolments/stats`);
      console.log(`   - GET /enrolments/check-teacher/:email`);
    });
    
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

/**
 * Manejo de cierre graceful
 */
process.on('SIGINT', async () => {
  console.log('\n🔴 Cerrando servicio...');
  
  if (connection) {
    await connection.end();
    console.log('💾 Conexión MySQL cerrada');
  }
  
  if (tunnel) {
    if (tunnel.server) tunnel.server.close();
    if (tunnel.conn) tunnel.conn.end();
    console.log('🔑 Túnel SSH cerrado');
  }
  
  process.exit(0);
});

// Iniciar el servicio
startServer();