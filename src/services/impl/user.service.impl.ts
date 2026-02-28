import bcrypt from 'bcrypt';
import { injectable, inject } from 'inversify';
import { IUserService } from '../interfaces/user.service.interface.js';
import { UserRepository } from '../../repository/interfaces/user.repository.js';
import { UserFilterParams, PaginatedResult } from '../../repositories/interfaces/user.repository.interface.js';
import { User, UserPublic, CreateUserData, UpdateUserData, UserStatus } from '../../models/user.model.js';
import { NotFoundError, ConflictError, AuthenticationError } from '../../utils/exceptions.js';
import { TOKENS } from '../../di/tokens.js';
import { getEventBus, Events } from '../../events/index.js';

@injectable()
export class UserServiceImpl implements IUserService {
  private readonly SALT_ROUNDS = 12;

  constructor(@inject(TOKENS.UserRepository) private userDao: UserRepository) {}

  private excludePassword(user: User): UserPublic {
    const { passwordHash, ...publicUser } = user;
    return publicUser as UserPublic;
  }

  async createUser(data: CreateUserData): Promise<UserPublic> {
    const existingUsername = await this.userDao.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError('Username already exists');
    }

    const existingEmail = await this.userDao.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError('Email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    const user = await this.userDao.save({
      ...data,
      passwordHash
    });

    return this.excludePassword(user);
  }

  async getUserById(id: number): Promise<UserPublic> {
    const user = await this.userDao.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.excludePassword(user);
  }

  async getUserByUsername(username: string): Promise<UserPublic> {
    const user = await this.userDao.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.excludePassword(user);
  }

  async getUserByEmail(email: string): Promise<UserPublic> {
    const user = await this.userDao.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.excludePassword(user);
  }

  async updateUser(id: number, data: UpdateUserData): Promise<UserPublic> {
    const existingUser = await this.userDao.findById(id);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    if (data.email && data.email !== existingUser.email) {
      const existingEmail = await this.userDao.findByEmail(data.email);
      if (existingEmail) {
        throw new ConflictError('Email already exists');
      }
    }

    const updatedUser = await this.userDao.update(id, data);
    return this.excludePassword(updatedUser);
  }

  async deleteUser(id: number): Promise<boolean> {
    const user = await this.userDao.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.userDao.deleteById(id);
  }

  async changePassword(id: number, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.userDao.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash!);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.userDao.update(id, { passwordHash } as Partial<User>);

    // Emit password changed event
    await getEventBus().publish(
      Events.passwordChanged({
        userId: id,
        changedBy: id
      })
    );

    return true;
  }

  async verifyUser(id: number): Promise<UserPublic> {
    const user = await this.userDao.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.isVerified) {
      throw new ConflictError('User is already verified');
    }

    const updatedUser = await this.userDao.update(id, { isVerified: true });

    // Emit user verified event
    await getEventBus().publish(
      Events.userVerified({
        userId: id,
        verifiedAt: new Date()
      })
    );

    return this.excludePassword(updatedUser);
  }

  async updateUserStatus(id: number, status: UserStatus): Promise<UserPublic> {
    const user = await this.userDao.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const oldStatus = user.status;
    const updatedUser = await this.userDao.updateStatus(id, status);

    // Emit user status changed event
    await getEventBus().publish(
      Events.userStatusChanged({
        userId: id,
        oldStatus,
        newStatus: status,
        changedBy: id // In real app, get from context
      })
    );

    return this.excludePassword(updatedUser);
  }

  async getUsers(params: UserFilterParams): Promise<PaginatedResult<UserPublic>> {
    const result = await this.userDao.findAllPaginated(params);
    return {
      items: result.items.map(user => this.excludePassword(user)),
      pagination: result.pagination
    };
  }
}
