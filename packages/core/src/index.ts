import _pool from "./db/pool.js";
import { authMiddleware, requireAcceso } from "./middleware/auth.js";
import { authRoutes } from "./auth.js";

export const pool = _pool;
export { authMiddleware, requireAcceso, authRoutes };
