import { Hono } from 'hono';
import pool from './db/pool.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = new Hono();

// POST /auth/login
app.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();

    // Validate input
    if (!username || !password) {
      return c.json({ error: 'Username y password son requeridos', code: 'VALIDATION_ERROR' }, 422);
    }

    // Find user
    const result = await pool.query(
      'SELECT id, username, password_hash, rol FROM core.usuario WHERE username = $1 AND activo = true',
      [username]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Credenciales inválidas', code: 'UNAUTHORIZED' }, 401);
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return c.json({ error: 'Credenciales inválidas', code: 'UNAUTHORIZED' }, 401);
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username, rol: user.rol },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '28800') }
    );

    return c.json({
      token,
      expires_in: parseInt(process.env.JWT_EXPIRES_IN || '28800'),
      usuario: {
        id: user.id,
        username: user.username,
        rol: user.rol,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' }, 500);
  }
});

export { app as authRoutes };
