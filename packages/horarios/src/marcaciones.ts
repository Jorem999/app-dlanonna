import { Hono } from 'hono';
import { pool } from '@dlanonna/core';

const app = new Hono();

// POST /marcaciones - Registrar marcación (público)
app.post('/', async (c) => {
  try {
    const { cedula, tipo, dispositivo, confirmar } = await c.req.json();

    // Validate cedula
    if (!cedula || !/^\d{10}$/.test(cedula)) {
      return c.json({ error: 'Cédula debe ser 10 dígitos', code: 'VALIDATION_ERROR' }, 422);
    }

    // Find employee
    const empleadoResult = await pool.query(
      'SELECT id, nombre, activo FROM horarios.empleado WHERE cedula = $1',
      [cedula]
    );

    if (empleadoResult.rows.length === 0) {
      return c.json({ error: 'Empleado no encontrado', code: 'NOT_FOUND' }, 404);
    }

    const empleado = empleadoResult.rows[0];

    if (!empleado.activo) {
      return c.json({ error: 'Empleado inactivo', code: 'NOT_FOUND' }, 404);
    }

    // Auto-detect tipo if not provided
    let tipoFinal = tipo;
    if (!tipoFinal) {
      const lastMarcacion = await pool.query(
        `SELECT tipo FROM horarios.marcacion 
         WHERE id_empleado = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Guayaquil') = CURRENT_DATE
         ORDER BY fecha_hora DESC LIMIT 1`,
        [empleado.id]
      );

      if (lastMarcacion.rows.length === 0) {
        tipoFinal = 'entrada';
      } else {
        tipoFinal = lastMarcacion.rows[0].tipo === 'entrada' ? 'salida' : 'entrada';
      }
    }

    // Validate tipo
    if (!['entrada', 'salida'].includes(tipoFinal)) {
      return c.json({ error: 'Tipo debe ser entrada o salida', code: 'VALIDATION_ERROR' }, 422);
    }

    // Check intervalo_minimo (if not confirming)
    if (!confirmar) {
      const regimenResult = await pool.query(
        `SELECT r.intervalo_minimo 
         FROM horarios.regimen r
         JOIN horarios.empleado e ON e.regimen_id = r.id
         WHERE e.id = $1`,
        [empleado.id]
      );

      if (regimenResult.rows.length > 0) {
        const intervaloMinimo = regimenResult.rows[0].intervalo_minimo;
        
        const lastMarcacion = await pool.query(
          `SELECT fecha_hora, tipo FROM horarios.marcacion 
           WHERE id_empleado = $1
           ORDER BY fecha_hora DESC LIMIT 1`,
          [empleado.id]
        );

        if (lastMarcacion.rows.length > 0) {
          const lastTime = new Date(lastMarcacion.rows[0].fecha_hora);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastTime.getTime()) / (1000 * 60);

          if (diffMinutes < intervaloMinimo) {
            return c.json({
              error: `Ya existe un registro hace ${Math.round(diffMinutes)} minutos. ¿Confirma este nuevo registro?`,
              code: 'SHORT_INTERVAL',
              ultimo_registro: {
                timestamp: lastMarcacion.rows[0].fecha_hora,
                tipo: lastMarcacion.rows[0].tipo,
              },
            }, 409);
          }
        }
      }
    }

    // Insert marcacion
    const result = await pool.query(
      `INSERT INTO horarios.marcacion (id_empleado, tipo, origen, dispositivo)
       VALUES ($1, $2, 'app', $3)
       RETURNING id, id_empleado, fecha_hora, tipo, origen, dispositivo`,
      [empleado.id, tipoFinal, dispositivo || null]
    );

    const marcacion = result.rows[0];

    return c.json({
      id: marcacion.id,
      empleado_id: marcacion.id_empleado,
      empleado_nombre: empleado.nombre,
      timestamp: marcacion.fecha_hora,
      tipo: marcacion.tipo,
      origen: marcacion.origen,
    }, 201);
  } catch (error) {
    console.error('Error creating marcacion:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// GET /marcaciones/hoy - Marcaciones del día actual
app.get('/hoy', async (c) => {
  try {
    const cedula = c.req.query('cedula');
    
    if (!cedula) {
      return c.json({ error: 'Cédula es requerida', code: 'VALIDATION_ERROR' }, 422);
    }

    // Find employee
    const empleadoResult = await pool.query(
      'SELECT id FROM horarios.empleado WHERE cedula = $1',
      [cedula]
    );

    if (empleadoResult.rows.length === 0) {
      return c.json({ error: 'Empleado no encontrado', code: 'NOT_FOUND' }, 404);
    }

    const empleadoId = empleadoResult.rows[0].id;

    // Get today's marcaciones
    const result = await pool.query(
      `SELECT id, tipo, fecha_hora as timestamp
       FROM horarios.marcacion
       WHERE id_empleado = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Guayaquil') = CURRENT_DATE
       ORDER BY fecha_hora`,
      [empleadoId]
    );

    return c.json(result.rows);
  } catch (error) {
    console.error('Error fetching marcaciones hoy:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// GET /marcaciones - Marcaciones en rango de fechas
app.get('/', async (c) => {
  try {
    const cedula = c.req.query('cedula');
    const desde = c.req.query('desde');
    const hasta = c.req.query('hasta');

    if (!cedula) {
      return c.json({ error: 'Cédula es requerida', code: 'VALIDATION_ERROR' }, 422);
    }

    // Find employee
    const empleadoResult = await pool.query(
      'SELECT id FROM horarios.empleado WHERE cedula = $1',
      [cedula]
    );

    if (empleadoResult.rows.length === 0) {
      return c.json({ error: 'Empleado no encontrado', code: 'NOT_FOUND' }, 404);
    }

    const empleadoId = empleadoResult.rows[0].id;

    // Build query with date range
    let query = `
      SELECT id, tipo, fecha_hora as timestamp
      FROM horarios.marcacion
      WHERE id_empleado = $1
    `;
    const params: any[] = [empleadoId];
    let paramIndex = 2;

    if (desde) {
      query += ` AND DATE(fecha_hora AT TIME ZONE 'America/Guayaquil') >= $${paramIndex++}`;
      params.push(desde);
    }

    if (hasta) {
      query += ` AND DATE(fecha_hora AT TIME ZONE 'America/Guayaquil') <= $${paramIndex++}`;
      params.push(hasta);
    }

    query += ' ORDER BY fecha_hora';

    const result = await pool.query(query, params);
    return c.json(result.rows);
  } catch (error) {
    console.error('Error fetching marcaciones:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// PUT /marcaciones/:id - Ajustar marcación (admin)
app.put('/:id', async (c) => {
  // TODO: Implement in V2 with auth middleware
  return c.json({ error: 'No implementado aún', code: 'NOT_IMPLEMENTED' }, 501);
});

export { app as marcacionRoutes };
