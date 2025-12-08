import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { RateLimitError } from '../utils/exceptions.js';

export const createRateLimiter = (options?: {
  windowMs?: number;
  max?: number;
  message?: string;
}) => {
  return rateLimit({
    windowMs: options?.windowMs ?? config.rateLimit.windowMs,
    max: options?.max ?? config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new RateLimitError(options?.message ?? 'Too many requests, please try again later'));
    }
  });
};

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again in 15 minutes'
});

export const apiRateLimiter = createRateLimiter();
