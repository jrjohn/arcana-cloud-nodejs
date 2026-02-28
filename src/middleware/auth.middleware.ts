import { Request, Response, NextFunction } from 'express';
import { resolve, TOKENS } from '../di/index.js';
import { AuthenticationError, AuthorizationError } from '../utils/exceptions.js';
import { UserRole } from '../models/user.model.js';
import { IAuthService } from '../services/auth.service.interface.js';

export const tokenRequired = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    const authService = resolve<IAuthService>(TOKENS.AuthService);
    const user = await authService.validateToken(token);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const roleRequired = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AuthorizationError('Insufficient permissions'));
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    const authService = resolve<IAuthService>(TOKENS.AuthService);

    try {
      const user = await authService.validateToken(token);
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
    } catch {
      // Token invalid but optional, continue without user
    }

    next();
  } catch (error) {
    next(error);
  }
};
