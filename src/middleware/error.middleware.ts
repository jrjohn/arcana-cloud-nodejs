import { Request, Response, NextFunction } from 'express';
import { APIException } from '../utils/exceptions.js';
import { errorResponse } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.requestId
  });

  if (err instanceof APIException) {
    res.status(err.statusCode).json(
      errorResponse(err.message, err.statusCode, err.errorCode, err.details, req.requestId)
    );
    return;
  }

  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json(
    errorResponse(
      isDev ? err.message : 'Internal server error',
      500,
      'INTERNAL_ERROR',
      isDev ? { stack: err.stack } : undefined,
      req.requestId
    )
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json(
    errorResponse('Resource not found', 404, 'NOT_FOUND', undefined, req.requestId)
  );
};
