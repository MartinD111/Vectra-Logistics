import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[Unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
};
