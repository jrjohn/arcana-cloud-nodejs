import { Router, Request, Response, NextFunction } from 'express';
import { validateSchema } from '../middleware/validation.middleware.js';
import { tokenRequired } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rate-limit.middleware.js';
import { successResponse } from '../utils/response.js';
import { CommunicationFactory } from '../communication/factory.js';
import { LoginSchema, RegisterSchema, RefreshTokenSchema } from '../schemas/auth.schema.js';

const router = Router();
const getService = () => CommunicationFactory.getServiceCommunication();

router.post('/register',
  validateSchema(RegisterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getService().register(req.body);
      res.status(201).json(
        successResponse(result, 'User registered successfully', req.requestId)
      );
    } catch (error) {
      next(error);
    }
  }
);

router.post('/login',
  authRateLimiter,
  validateSchema(LoginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { usernameOrEmail, password } = req.body;
      const result = await getService().login({
        usernameOrEmail,
        password,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      res.json(successResponse(result, 'Login successful', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.post('/logout',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      await getService().logout(token!);
      res.json(successResponse(null, 'Logout successful', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.post('/refresh',
  validateSchema(RefreshTokenSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const tokens = await getService().refreshToken(refreshToken);
      res.json(successResponse(tokens, 'Token refreshed successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.get('/me',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getService().getUserById(req.user!.id);
      res.json(successResponse(user, 'User retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.get('/tokens',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await getService().getUserTokens(req.user!.id);
      res.json(successResponse(tokens, 'Tokens retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.post('/tokens/revoke-all',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await getService().revokeAllTokens(req.user!.id);
      res.json(successResponse({ revokedCount: count }, 'All tokens revoked', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
