import { Hono } from 'hono';
import { regimenRoutes } from './regimenes.js';
import { empleadoRoutes } from './empleados.js';
import { marcacionRoutes } from './marcaciones.js';
import { reporteRoutes } from './reportes.js';

export function registerHorarios(app: Hono) {
  app.route('/api/horarios/regimenes', regimenRoutes);
  app.route('/api/horarios/empleados', empleadoRoutes);
  app.route('/api/horarios/marcaciones', marcacionRoutes);
  app.route('/api/horarios/reportes', reporteRoutes);
}
