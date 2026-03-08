import { Response } from 'express';

export type ApiSuccess<T = unknown> = { success: true; data: T };
export type ApiError = { success: false; error: string; code?: string; details?: unknown };

export function sendSuccess<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data } as ApiSuccess<T>);
}

export function sendError(
  res: Response,
  message: string,
  status = 400,
  code?: string,
  details?: unknown
): Response {
  const body: ApiError = { success: false, error: message };
  if (code) body.code = code;
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}
