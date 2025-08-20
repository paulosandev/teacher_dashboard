async function testEndpoint() {
  console.log('='.repeat(60));
  console.log('Probando endpoint /api/user/moodle-token/test');
  console.log('='.repeat(60));

  try {
    // Hacer una solicitud POST al endpoint
    const response = await fetch('http://localhost:3002/api/user/moodle-token/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Simular cookie de sesión si es necesaria
        'Cookie': 'next-auth.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...'
      }
    });

    const data = await response.json();
    
    console.log('\n📋 Respuesta del endpoint:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Token válido!');
      console.log(`   Usuario: ${data.userInfo?.fullname}`);
      console.log(`   Cursos donde es profesor: ${data.coursesCount}`);
      
      if (data.courses && data.courses.length > 0) {
        console.log('\n📚 Algunos cursos:');
        data.courses.forEach((course: any) => {
          console.log(`   - ${course.fullname} (${course.shortname})`);
        });
      }
    } else {
      console.log('\n❌ Error:', data.error);
    }

  } catch (error) {
    console.error('\n❌ Error haciendo solicitud:', error);
  }

  console.log('\n' + '='.repeat(60));
}

// Ejecutar el test
testEndpoint().catch(console.error);
