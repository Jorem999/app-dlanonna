import { Hono } from 'hono';
import { authMiddleware, requireAcceso } from '@dlanonna/core';
import { pool } from '@dlanonna/core';

const app = new Hono();

// Auth + nivel lectura mínimo para acceder al módulo horarios
app.use('*', authMiddleware, requireAcceso('horarios', 'lectura'));

// GET /regimenes
app.get('/', async (c) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, tipo, tolerancia_min, intervalo_minimo, hora_entrada, hora_salida, activo FROM horarios.regimen ORDER BY nombre'
    );
    return c.json(result.rows);
  } catch (error) {
    console.error('Error fetching regimenes:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// POST /regimenes
app.post('/', requireAcceso('horarios', 'gestion'), async (c) => {
  try {
    const { nombre, tipo, tolerancia_min, intervalo_minimo, hora_entrada, hora_salida } = await c.req.json();

    // Validate required fields
    if (!nombre || !tipo) {
      return c.json({ error: 'Nombre y tipo son requeridos', code: 'VALIDATION_ERROR' }, 422);
    }

    // Validate tipo
    if (!['fijo', 'flexible'].includes(tipo)) {
      return c.json({ error: 'Tipo debe ser fijo o flexible', code: 'VALIDATION_ERROR' }, 422);
    }

    const result = await pool.query(
      `INSERT INTO horarios.regimen (nombre, tipo, tolerancia_min, intervalo_minimo, hora_entrada, hora_salida)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, tipo, tolerancia_min, intervalo_minimo, hora_entrada, hora_salida, activo`,
      [nombre, tipo, tolerancia_min || 0, intervalo_minimo || 30, hora_entrada || null, hora_salida || null]
    );

    return c.json(result.rows[0], 201);
  } catch (error) {
    console.error('Error creating regimen:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// GET /regimenes/:id
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query(
      'SELECT id, nombre, tipo, tolerancia_min, intervalo_minimo, hora_entrada, hora_salida, activo FROM horarios.regimen WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Régimen no encontrado', code: 'NOT_FOUND' }, 404);
    }

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching regimen:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// PUT /regimenes/:id
app.put('/:id', requireAcceso('horarios', 'gestion'), async (c) => {
  try {
    const id = c.req.param('id');
    const { nombre, tipo, tolerancia_min, intervalo_minimo, hora_entrada, hora_salida } = await c.req.json();

    // Check if exists
    const exists = await pool.query('SELECT id FROM horarios.regimen WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return c.json({ error: 'Régimen no encontrado', code: 'NOT_FOUND' }, 404);
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nombre !== undefined) { updates.push(`nombre = $${paramIndex++}`); values.push(nombre); }
    if (tipo !== undefined) {
      if (!['fijo', 'flexible'].includes(tipo)) {
        return c.json({ error: 'Tipo debe ser fijo o flexible', code: 'VALIDATION_ERROR' }, 422);
      }
      updates.push(`tipo = $${paramIndex++}`); values.push(tipo);
    }
    if (tolerancia_min !== undefined) { updates.push(`tolerancia_min = $${paramIndex++}`); values.push(tolerancia_min); }
    if (intervalo_minimo !== undefined) { updates.push(`intervalo_minimo = $${paramIndex++}`); values.push(intervalo_minimo); }
    if (hora_entrada !== undefined) { updates.push(`hora_entrada = $${paramIndex++}`); values.push(hora_entrada); }
    if (hora_salida !== undefined) { updates.push(`hora_salida = $${paramIndex++}`); values.push(hora_salida); }

    if (updates.length === 0) {
      return c.json({ error: 'No hay campos para actualizar', code: 'VALIDATION_ERROR' }, 422);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE horarios.regimen SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, nombre, tipo, tolerancia_min, intervalo_minimo, hora_entrada, hora_salida, activo`,
      values
    );

    return c.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating regimen:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

// DELETE /regimenes/:id (soft delete)
app.delete('/:id', requireAcceso('horarios', 'gestion'), async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query(
      'UPDATE horarios.regimen SET activo = false WHERE id = $1 AND activo = true RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Régimen no encontrado', code: 'NOT_FOUND' }, 404);
    }

    return c.body(null, 204);
  } catch (error) {
    console.error('Error deleting regimen:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

export { app as regimenRoutes };
