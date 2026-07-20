import { Context, Next, MiddlewareHandler } from 'hono';
import jwt from 'jsonwebtoken';

// Jerarquía de niveles (índice = nivel de acceso)
const NIVELES: Record<string, number> = {
  marcacion: 0,
  lectura: 1,
  gestion: 2,
  admin: 3,
};

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

/**
 * Crea un middleware que verifica que el usuario tenga acceso a un módulo
 * con al menos el nivel mínimo especificado.
 *
 * @param modulo - Nombre del módulo (ej: 'horarios', 'produccion')
 * @param nivelMinimo - Nivel requerido: 'marcacion' | 'lectura' | 'gestion' | 'admin'
 */
export function requireAcceso(modulo: string, nivelMinimo: string): MiddlewareHandler {
  const nivelRequerido = NIVELES[nivelMinimo];
  if (nivelRequerido === undefined) {
    throw new Error(`Nivel inválido: ${nivelMinimo}`);
  }

  return async (c: Context, next: Next) => {
    const user = c.get('user') as any;

    if (!user) {
      return c.json({ error: 'Token de autenticación requerido', code: 'UNAUTHORIZED' }, 401);
    }

    // Admin tiene acceso implícito a todo
    if (user.rol_base === 'admin') {
      await next();
      return;
    }

    // Buscar acceso al módulo
    const acceso = (user.accesos || []).find((a: any) => a.modulo === modulo);

    if (!acceso) {
      return c.json({
        error: `No tienes acceso al módulo ${modulo}`,
        code: 'FORBIDDEN',
      }, 403);
    }

    const nivelUsuario = NIVELES[acceso.nivel];
    if (nivelUsuario === undefined || nivelUsuario < nivelRequerido) {
      return c.json({
        error: `Se requiere nivel ${nivelMinimo} en ${modulo}`,
        code: 'FORBIDDEN',
      }, 403);
    }

    await next();
  };
}
