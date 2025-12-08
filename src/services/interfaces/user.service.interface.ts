import {
  UserPublic,
  CreateUserData,
  UpdateUserData,
  UserStatus
} from '../../models/user.model.js';
import { PaginatedResult, UserFilterParams } from '../../repositories/interfaces/user.repository.interface.js';

export interface IUserService {
  createUser(data: CreateUserData): Promise<UserPublic>;
  getUserById(id: number): Promise<UserPublic>;
  getUserByUsername(username: string): Promise<UserPublic>;
  getUserByEmail(email: string): Promise<UserPublic>;
  updateUser(id: number, data: UpdateUserData): Promise<UserPublic>;
  deleteUser(id: number): Promise<boolean>;
  changePassword(id: number, oldPassword: string, newPassword: string): Promise<boolean>;
  verifyUser(id: number): Promise<UserPublic>;
  updateUserStatus(id: number, status: UserStatus): Promise<UserPublic>;
  getUsers(params: UserFilterParams): Promise<PaginatedResult<UserPublic>>;
}
