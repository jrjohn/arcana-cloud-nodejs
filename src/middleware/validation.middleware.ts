import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../utils/exceptions.js';

export const validateSchema = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string> = {};
        error.errors.forEach(err => {
          const path = err.path.slice(1).join('.');
          details[path] = err.message;
        });
        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
};

export const validatePagination = (options: { maxPerPage?: number } = {}) => {
  const { maxPerPage = 100 } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    let page = parseInt(req.query.page as string) || 1;
    let perPage = parseInt(req.query.perPage as string) || 20;

    if (page < 1) page = 1;
    if (perPage < 1) perPage = 1;
    if (perPage > maxPerPage) perPage = maxPerPage;

    req.query.page = String(page);
    req.query.perPage = String(perPage);

    next();
  };
};
