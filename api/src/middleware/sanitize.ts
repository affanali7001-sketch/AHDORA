import type { NextFunction, Request, Response } from 'express';
import { sanitizeInPlace } from '../lib/sanitize.js';

/**
 * Strip MongoDB operator keys (`$...` and dotted keys) from the
 * request body, query and params before any handler runs. Express 5
 * exposes req.query through a getter, so the object is sanitised in
 * place rather than replaced.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.query);
  sanitizeInPlace(req.params);
  next();
}
