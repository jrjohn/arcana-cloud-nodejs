import bcrypt from 'bcrypt';
import { IUserService } from '../interfaces/user.service.interface.js';
import { IUserRepository, UserFilterParams, PaginatedResult } from '../../repositories/interfaces/user.repository.interface.js';
import { User, UserPublic, CreateUserData, UpdateUserData, UserStatus } from '../../models/user.model.js';
import { NotFoundError, ConflictError, AuthenticationError } from '../../utils/exceptions.js';

export class UserServiceImpl implements IUserService {
  private readonly SALT_ROUNDS = 12;

  constructor(private userRepository: IUserRepository) {}

  private excludePassword(user: User): UserPublic {
    const { passwordHash, ...publicUser } = user;
    return publicUser as UserPublic;
  }

  async createUser(data: CreateUserData): Promise<UserPublic> {
    const existingUsername = await this.userRepository.getByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError('Username already exists');
    }

    const existingEmail = await this.userRepository.getByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError('Email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, this.SALT_ROUNDS);

    const user = await this.userRepository.create({
      ...data,
      passwordHash
    });

    return this.excludePassword(user);
  }

  async getUserById(id: number): Promise<UserPublic> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.excludePassword(user);
  }

  async getUserByUsername(username: string): Promise<UserPublic> {
    const user = await this.userRepository.getByUsername(username);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.excludePassword(user);
  }

  async getUserByEmail(email: string): Promise<UserPublic> {
    const user = await this.userRepository.getByEmail(email);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.excludePassword(user);
  }

  async updateUser(id: number, data: UpdateUserData): Promise<UserPublic> {
    const existingUser = await this.userRepository.getById(id);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    if (data.email && data.email !== existingUser.email) {
      const existingEmail = await this.userRepository.getByEmail(data.email);
      if (existingEmail) {
        throw new ConflictError('Email already exists');
      }
    }

    const updatedUser = await this.userRepository.update(id, data);
    return this.excludePassword(updatedUser);
  }

  async deleteUser(id: number): Promise<boolean> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.userRepository.delete(id);
  }

  async changePassword(id: number, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash!);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.userRepository.update(id, { passwordHash } as Partial<User>);

    return true;
  }

  async verifyUser(id: number): Promise<UserPublic> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.isVerified) {
      throw new ConflictError('User is already verified');
    }

    const updatedUser = await this.userRepository.update(id, { isVerified: true });
    return this.excludePassword(updatedUser);
  }

  async updateUserStatus(id: number, status: UserStatus): Promise<UserPublic> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updatedUser = await this.userRepository.update(id, { status });
    return this.excludePassword(updatedUser);
  }

  async getUsers(params: UserFilterParams): Promise<PaginatedResult<UserPublic>> {
    const result = await this.userRepository.getAll(params);
    return {
      items: result.items.map(user => this.excludePassword(user)),
      pagination: result.pagination
    };
  }
}
