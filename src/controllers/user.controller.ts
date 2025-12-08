import { Router, Request, Response, NextFunction } from 'express';
import { tokenRequired, roleRequired } from '../middleware/auth.middleware.js';
import { validateSchema, validatePagination } from '../middleware/validation.middleware.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import { CommunicationFactory } from '../communication/factory.js';
import { UserRole, UserStatus } from '../models/user.model.js';
import { AuthorizationError } from '../utils/exceptions.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ChangePasswordSchema,
  UpdateStatusSchema
} from '../schemas/user.schema.js';

const router = Router();
const getService = () => CommunicationFactory.getServiceCommunication();

router.get('/',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  validatePagination({ maxPerPage: 100 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage, role, status } = req.query;
      const result = await getService().getUsers({
        page: Number(page) || 1,
        perPage: Number(perPage) || 20,
        role: role as UserRole,
        status: status as UserStatus
      });
      res.json(paginatedResponse(result.items, result.pagination, req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:userId',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);

      if (req.user!.role !== UserRole.ADMIN && req.user!.id !== userId) {
        throw new AuthorizationError('Not authorized to view this user');
      }

      const user = await getService().getUserById(userId);
      res.json(successResponse(user, 'User retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.post('/',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  validateSchema(CreateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getService().createUser(req.body);
      res.status(201).json(successResponse(user, 'User created successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:userId',
  tokenRequired,
  validateSchema(UpdateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);

      if (req.user!.role !== UserRole.ADMIN && req.user!.id !== userId) {
        throw new AuthorizationError('Not authorized to update this user');
      }

      const user = await getService().updateUser(userId, req.body);
      res.json(successResponse(user, 'User updated successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:userId',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);
      await getService().deleteUser(userId);
      res.json(successResponse(null, 'User deleted successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:userId/password',
  tokenRequired,
  validateSchema(ChangePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);

      if (req.user!.id !== userId) {
        throw new AuthorizationError('Not authorized to change this password');
      }

      await getService().changePassword(userId, req.body);
      res.json(successResponse(null, 'Password changed successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.post('/:userId/verify',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await getService().verifyUser(userId);
      res.json(successResponse(user, 'User verified successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:userId/status',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  validateSchema(UpdateStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.params.userId);
      const { status } = req.body;
      const user = await getService().updateUserStatus(userId, status);
      res.json(successResponse(user, 'User status updated successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
