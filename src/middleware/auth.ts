import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  apiKey: string;
  dbUrl?: string;
}

/**
 * Simple API key authentication middleware.
 * Validates the x-api-key header against environment-configured keys.
 *
 * For v1, we support a single API key via KERNAL_API_KEY env var.
 * Multi-tenant (per-user Turso DBs) can be added later.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      error: 'Authentication required',
      hint: 'Provide your API key via the x-api-key header',
    });
    return;
  }

  const validKey = process.env.KERNAL_API_KEY;
  if (!validKey) {
    res.status(500).json({
      error: 'Server misconfigured',
      hint: 'KERNAL_API_KEY environment variable is not set',
    });
    return;
  }

  if (apiKey !== validKey) {
    res.status(401).json({
      error: 'Invalid API key',
      hint: 'Check your API key and try again',
    });
    return;
  }

  (req as AuthenticatedRequest).apiKey = apiKey;
  next();
}
