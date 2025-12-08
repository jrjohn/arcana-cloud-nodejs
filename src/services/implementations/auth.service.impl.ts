import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { injectable, inject } from 'inversify';
import { IAuthService, LoginData, AuthResult } from '../interfaces/auth.service.interface.js';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface.js';
import { IOAuthTokenRepository } from '../../repositories/interfaces/oauth-token.repository.interface.js';
import { User, UserPublic, CreateUserData, UserStatus } from '../../models/user.model.js';
import { OAuthToken, TokenPair } from '../../models/oauth-token.model.js';
import { AuthenticationError, ConflictError } from '../../utils/exceptions.js';
import { config } from '../../config.js';
import { TOKENS } from '../../di/tokens.js';

interface JWTPayload {
  userId: number;
  username: string;
  email: string;
  role: string;
  tokenType: 'access' | 'refresh';
  jti: string;
  iat: number;
  exp: number;
}

@injectable()
export class AuthServiceImpl implements IAuthService {
  private readonly SALT_ROUNDS = 12;

  constructor(
    @inject(TOKENS.UserRepository) private userRepository: IUserRepository,
    @inject(TOKENS.OAuthTokenRepository) private tokenRepository: IOAuthTokenRepository
  ) {}

  private excludePassword(user: User): UserPublic {
    const { passwordHash, ...publicUser } = user;
    return publicUser as UserPublic;
  }

  private generateTokenPair(user: User): TokenPair {
    const jti = uuidv4();

    const accessTokenPayload: Partial<JWTPayload> = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tokenType: 'access',
      jti
    };

    const refreshTokenPayload: Partial<JWTPayload> = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tokenType: 'refresh',
      jti
    };

    const accessToken = jwt.sign(accessTokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiresIn
    });

    const refreshToken = jwt.sign(refreshTokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.accessExpiresInSeconds,
      tokenType: 'Bearer'
    };
  }

  async login(data: LoginData): Promise<AuthResult> {
    const { usernameOrEmail, password, ipAddress, userAgent } = data;

    let user = await this.userRepository.getByUsername(usernameOrEmail);
    if (!user) {
      user = await this.userRepository.getByEmail(usernameOrEmail);
    }

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AuthenticationError('Account is not active');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash!);
    if (!isValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    const tokens = this.generateTokenPair(user);

    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInSeconds * 1000);
    await this.tokenRepository.create({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      ipAddress,
      userAgent
    });

    await this.userRepository.updateLastLogin(user.id);

    return {
      user: this.excludePassword(user),
      tokens
    };
  }

  async logout(accessToken: string): Promise<boolean> {
    const token = await this.tokenRepository.getByAccessToken(accessToken);
    if (!token) {
      return true;
    }

    await this.tokenRepository.revoke(token.id);
    return true;
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    let payload: JWTPayload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.secret) as JWTPayload;
    } catch {
      throw new AuthenticationError('Invalid refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw new AuthenticationError('Invalid token type');
    }

    const storedToken = await this.tokenRepository.getByRefreshToken(refreshToken);
    if (!storedToken || storedToken.isRevoked) {
      throw new AuthenticationError('Token has been revoked');
    }

    const user = await this.userRepository.getById(payload.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AuthenticationError('User not found or inactive');
    }

    await this.tokenRepository.revoke(storedToken.id);

    const tokens = this.generateTokenPair(user);

    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInSeconds * 1000);
    await this.tokenRepository.create({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      ipAddress: storedToken.ipAddress ?? undefined,
      userAgent: storedToken.userAgent ?? undefined
    });

    return tokens;
  }

  async validateToken(accessToken: string): Promise<UserPublic> {
    let payload: JWTPayload;
    try {
      payload = jwt.verify(accessToken, config.jwt.secret) as JWTPayload;
    } catch {
      throw new AuthenticationError('Invalid access token');
    }

    if (payload.tokenType !== 'access') {
      throw new AuthenticationError('Invalid token type');
    }

    const storedToken = await this.tokenRepository.getByAccessToken(accessToken);
    if (storedToken?.isRevoked) {
      throw new AuthenticationError('Token has been revoked');
    }

    const user = await this.userRepository.getById(payload.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    return this.excludePassword(user);
  }

  async register(data: CreateUserData): Promise<AuthResult> {
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

    const tokens = this.generateTokenPair(user);

    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInSeconds * 1000);
    await this.tokenRepository.create({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt
    });

    return {
      user: this.excludePassword(user),
      tokens
    };
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash!);
  }

  async revokeAllTokens(userId: number): Promise<number> {
    return this.tokenRepository.revokeAllForUser(userId);
  }

  async getUserTokens(userId: number): Promise<OAuthToken[]> {
    return this.tokenRepository.getActiveForUser(userId);
  }
}
