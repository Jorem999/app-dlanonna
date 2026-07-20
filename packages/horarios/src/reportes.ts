import { Hono } from 'hono';
import { authMiddleware, requireAcceso } from '@dlanonna/core';
import { pool } from '@dlanonna/core';

const app = new Hono();

// Auth + nivel lectura mínimo para acceder al módulo horarios
app.use('*', authMiddleware, requireAcceso('horarios', 'lectura'));

// GET /reportes/diario
app.get('/diario', async (c) => {
  try {
    const fecha = c.req.query('fecha') || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT 
        e.id as empleado_id,
        e.nombre,
        e.cedula,
        r.nombre as regimen,
        $1 as fecha,
        MIN(CASE WHEN m.tipo = 'entrada' THEN m.fecha_hora END) as primera_entrada,
        MAX(CASE WHEN m.tipo = 'salida' THEN m.fecha_hora END) as ultima_salida,
        COUNT(CASE WHEN m.tipo = 'entrada' THEN 1 END) as total_entradas,
        COUNT(CASE WHEN m.tipo = 'salida' THEN 1 END) as total_salidas
       FROM horarios.empleado e
       JOIN horarios.regimen r ON r.id = e.regimen_id
       LEFT JOIN horarios.marcacion m ON m.id_empleado = e.id 
         AND DATE(m.fecha_hora AT TIME ZONE 'America/Guayaquil') = $1
       WHERE e.activo = true
       GROUP BY e.id, e.nombre, e.cedula, r.nombre
       ORDER BY e.nombre`,
      [fecha]
    );

    return c.json(result.rows);
  } catch (error) {
    console.error('Error fetching reporte diario:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// GET /reportes/semanal
app.get('/semanal', async (c) => {
  try {
    const desde = c.req.query('desde');
    const hasta = c.req.query('hasta');

    if (!desde || !hasta) {
      return c.json({ error: 'Las fechas desde y hasta son requeridas', code: 'VALIDATION_ERROR' }, 422);
    }

    const result = await pool.query(
      `SELECT 
        e.id as empleado_id,
        e.nombre,
        e.cedula,
        DATE(m.fecha_hora AT TIME ZONE 'America/Guayaquil') as fecha,
        MIN(CASE WHEN m.tipo = 'entrada' THEN m.fecha_hora END) as primera_entrada,
        MAX(CASE WHEN m.tipo = 'salida' THEN m.fecha_hora END) as ultima_salida
       FROM horarios.empleado e
       JOIN horarios.marcacion m ON m.id_empleado = e.id
       WHERE DATE(m.fecha_hora AT TIME ZONE 'America/Guayaquil') BETWEEN $1 AND $2
       GROUP BY e.id, e.nombre, e.cedula, DATE(m.fecha_hora AT TIME ZONE 'America/Guayaquil')
       ORDER BY e.nombre, fecha`,
      [desde, hasta]
    );

    return c.json(result.rows);
  } catch (error) {
    console.error('Error fetching reporte semanal:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

export { app as reporteRoutes };
