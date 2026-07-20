import { Hono } from 'hono';
import { authMiddleware } from '@dlanonna/core';
import { pool } from '@dlanonna/core';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// GET /empleados
app.get('/', async (c) => {
  try {
    const incluirInactivos = c.req.query('incluir_inactivos') === 'true';
    
    let query = `
      SELECT e.id, e.cedula, e.nombre, e.telefono, e.cargo, e.fecha_ingreso, e.activo,
             r.id as regimen_id, r.nombre as regimen_nombre, r.tipo as regimen_tipo
      FROM horarios.empleado e
      LEFT JOIN horarios.regimen r ON r.id = e.regimen_id
    `;
    
    if (!incluirInactivos) {
      query += ' WHERE e.activo = true';
    }
    
    query += ' ORDER BY e.nombre';

    const result = await pool.query(query);
    return c.json(result.rows);
  } catch (error) {
    console.error('Error fetching empleados:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// POST /empleados
app.post('/', async (c) => {
  try {
    const { cedula, nombre, telefono, cargo, fecha_ingreso, regimen_id } = await c.req.json();

    // Validate required fields
    if (!cedula || !nombre || !regimen_id) {
      return c.json({ error: 'Cédula, nombre y régimen son requeridos', code: 'VALIDATION_ERROR' }, 422);
    }

    // Validate cedula format (10 digits)
    if (!/^\d{10}$/.test(cedula)) {
      return c.json({ error: 'Cédula debe ser 10 dígitos', code: 'VALIDATION_ERROR' }, 422);
    }

    // Check if cedula already exists
    const existsCedula = await pool.query('SELECT id FROM horarios.empleado WHERE cedula = $1', [cedula]);
    if (existsCedula.rows.length > 0) {
      return c.json({ error: 'La cédula ya está registrada', code: 'CONFLICT' }, 409);
    }

    // Check if regimen exists and is active
    const existsRegimen = await pool.query('SELECT id FROM horarios.regimen WHERE id = $1 AND activo = true', [regimen_id]);
    if (existsRegimen.rows.length === 0) {
      return c.json({ error: 'El régimen especificado no existe o está inactivo', code: 'VALIDATION_ERROR' }, 422);
    }

    const result = await pool.query(
      `INSERT INTO horarios.empleado (cedula, nombre, telefono, cargo, fecha_ingreso, regimen_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, cedula, nombre, telefono, cargo, fecha_ingreso, activo, regimen_id`,
      [cedula, nombre, telefono || null, cargo || null, fecha_ingreso || new Date().toISOString().split('T')[0], regimen_id]
    );

    return c.json(result.rows[0], 201);
  } catch (error) {
    console.error('Error creating empleado:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// GET /empleados/:id
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query(
      `SELECT e.id, e.cedula, e.nombre, e.telefono, e.cargo, e.fecha_ingreso, e.activo,
              r.id as regimen_id, r.nombre as regimen_nombre, r.tipo as regimen_tipo
       FROM horarios.empleado e
       LEFT JOIN horarios.regimen r ON r.id = e.regimen_id
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Empleado no encontrado', code: 'NOT_FOUND' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching empleado:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// PUT /empleados/:id
app.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { cedula, nombre, telefono, cargo, fecha_ingreso, regimen_id, activo } = await c.req.json();

    // Check if exists
    const exists = await pool.query('SELECT id FROM horarios.empleado WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return c.json({ error: 'Empleado no encontrado', code: 'NOT_FOUND' }, 404);
    }

    // Validate cedula if provided
    if (cedula && !/^\d{10}$/.test(cedula)) {
      return c.json({ error: 'Cédula debe ser 10 dígitos', code: 'VALIDATION_ERROR' }, 422);
    }

    // Check cedula uniqueness if changing
    if (cedula) {
      const existsCedula = await pool.query('SELECT id FROM horarios.empleado WHERE cedula = $1 AND id != $2', [cedula, id]);
      if (existsCedula.rows.length > 0) {
        return c.json({ error: 'La cédula ya está registrada', code: 'CONFLICT' }, 409);
      }
    }

    // Check regimen if provided
    if (regimen_id) {
      const existsRegimen = await pool.query('SELECT id FROM horarios.regimen WHERE id = $1 AND activo = true', [regimen_id]);
      if (existsRegimen.rows.length === 0) {
        return c.json({ error: 'El régimen especificado no existe o está inactivo', code: 'VALIDATION_ERROR' }, 422);
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (cedula !== undefined) { updates.push(`cedula = $${paramIndex++}`); values.push(cedula); }
    if (nombre !== undefined) { updates.push(`nombre = $${paramIndex++}`); values.push(nombre); }
    if (telefono !== undefined) { updates.push(`telefono = $${paramIndex++}`); values.push(telefono); }
    if (cargo !== undefined) { updates.push(`cargo = $${paramIndex++}`); values.push(cargo); }
    if (fecha_ingreso !== undefined) { updates.push(`fecha_ingreso = $${paramIndex++}`); values.push(fecha_ingreso); }
    if (regimen_id !== undefined) { updates.push(`regimen_id = $${paramIndex++}`); values.push(regimen_id); }
    if (activo !== undefined) { updates.push(`activo = $${paramIndex++}`); values.push(activo); }

    if (updates.length === 0) {
      return c.json({ error: 'No hay campos para actualizar', code: 'VALIDATION_ERROR' }, 422);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE horarios.empleado SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, cedula, nombre, telefono, cargo, fecha_ingreso, activo, regimen_id`,
      values
    );

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating empleado:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// DELETE /empleados/:id (soft delete)
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query(
      'UPDATE horarios.empleado SET activo = false WHERE id = $1 AND activo = true RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Empleado no encontrado', code: 'NOT_FOUND' }, 404);
    }

    return c.body(null, 204);
  } catch (error) {
    console.error('Error deleting empleado:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

export { app as empleadoRoutes };
