import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

export const authMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Token de autenticación requerido', code: 'UNAUTHORIZED' }, 401);
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    
    // Add user info to context
    c.set('user', decoded);
    
    await next();
  } catch (error) {
    return c.json({ error: 'Token inválido o expirado', code: 'UNAUTHORIZED' }, 401);
  }
};
