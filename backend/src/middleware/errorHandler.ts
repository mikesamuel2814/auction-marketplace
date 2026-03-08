import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }
  if (err instanceof Error) {
    const message = err.message || 'Internal server error';
    const status = 'statusCode' in err && typeof (err as { statusCode: number }).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 500;
    res.status(status).json({
      success: false,
      error: message,
      code: status === 500 ? 'INTERNAL_ERROR' : 'ERROR',
    });
    return;
  }
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
