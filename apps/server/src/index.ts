import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import { authRoutes } from '@dlanonna/core';
import { registerHorarios } from '@dlanonna/horarios';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve path to horarios frontend (from workspace root)
const horariosFrontend = path.resolve(process.cwd(), 'packages/horarios/frontend');

const app = new Hono();

// Middleware
app.use('*', cors());

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    app: 'dlanonna',
    modules: ['horarios'],
    timestamp: new Date().toISOString(),
  });
});

// Auth global (login admin)
app.route('/api/auth', authRoutes);

// Registrar módulos
registerHorarios(app);

// Serve frontend static files
app.use('/*', serveStatic({ root: horariosFrontend }));

// Default route → marcación (pantalla táctil)
app.get('/', serveStatic({ path: path.join(horariosFrontend, 'marcacion/index.html') }));

const port = parseInt(process.env.PORT || '3000');

console.log(' D\'la Nonna — server running on port', port);
serve({
  fetch: app.fetch,
  port,
});
