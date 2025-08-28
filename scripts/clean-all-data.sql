-- Script para limpiar TODA la información de la aplicación
-- CUIDADO: Esto eliminará todos los análisis, cursos, grupos y caché

-- Truncar todas las tablas en orden correcto (respetando FK)
TRUNCATE TABLE "AnalysisQueue" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "CourseCache" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "JobLog" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "ActivityAnalysis" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "AnalysisResult" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "UserMoodleToken" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Group" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Course" RESTART IDENTITY CASCADE;

-- Verificar que todas las tablas están vacías
SELECT 
  schemaname,
  tablename, 
  n_tup_ins - n_tup_del as row_count
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY tablename;