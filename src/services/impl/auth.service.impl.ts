import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { injectable, inject } from 'inversify';
import { IAuthService, LoginData, AuthResult } from '../interfaces/auth.service.interface.js';
import { UserRepository } from '../../repository/interfaces/user.repository.js';
import { OAuthTokenRepository } from '../../repository/interfaces/oauth-token.repository.js';
import { User, UserPublic, CreateUserData, UserStatus } from '../../models/user.model.js';
import { OAuthToken, TokenPair } from '../../models/oauth-token.model.js';
import { AuthenticationError, ConflictError } from '../../utils/exceptions.js';
import { config } from '../../config.js';
import { TOKENS } from '../../di/tokens.js';
import { getEventBus, Events } from '../../events/index.js';

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
    @inject(TOKENS.UserRepository) private userDao: UserRepository,
    @inject(TOKENS.OAuthTokenRepository) private tokenDao: OAuthTokenRepository
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

    let user = await this.userDao.findByUsername(usernameOrEmail);
    if (!user) {
      user = await this.userDao.findByEmail(usernameOrEmail);
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
    await this.tokenDao.save({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      ipAddress,
      userAgent
    });

    await this.userDao.updateLastLogin(user.id);

    // Emit user logged in event
    await getEventBus().publish(
      Events.userLoggedIn({
        userId: user.id,
        username: user.username,
        email: user.email,
        ipAddress,
        userAgent,
        loginMethod: 'password'
      })
    );

    return {
      user: this.excludePassword(user),
      tokens
    };
  }

  async logout(accessToken: string): Promise<boolean> {
    const token = await this.tokenDao.findByAccessToken(accessToken);
    if (!token) {
      return true;
    }

    await this.tokenDao.revoke(token.id);

    // Emit user logged out event
    await getEventBus().publish(
      Events.userLoggedOut({
        userId: token.userId,
        tokenId: token.id,
        logoutType: 'single'
      })
    );

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

    const storedToken = await this.tokenDao.findByRefreshToken(refreshToken);
    if (!storedToken || storedToken.isRevoked) {
      throw new AuthenticationError('Token has been revoked');
    }

    const user = await this.userDao.findById(payload.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AuthenticationError('User not found or inactive');
    }

    await this.tokenDao.revoke(storedToken.id);

    const tokens = this.generateTokenPair(user);

    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInSeconds * 1000);
    await this.tokenDao.save({
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

    const storedToken = await this.tokenDao.findByAccessToken(accessToken);
    if (storedToken?.isRevoked) {
      throw new AuthenticationError('Token has been revoked');
    }

    const user = await this.userDao.findById(payload.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    return this.excludePassword(user);
  }

  async register(data: CreateUserData): Promise<AuthResult> {
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

    const tokens = this.generateTokenPair(user);

    const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInSeconds * 1000);
    await this.tokenDao.save({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt
    });

    // Emit user registered event
    await getEventBus().publish(
      Events.userRegistered({
        userId: user.id,
        username: user.username,
        email: user.email,
        firstName: data.firstName,
        lastName: data.lastName
      })
    );

    return {
      user: this.excludePassword(user),
      tokens
    };
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash!);
  }

  async revokeAllTokens(userId: number): Promise<number> {
    const count = await this.tokenDao.revokeAllByUserId(userId);

    // Emit all tokens revoked event
    if (count > 0) {
      await getEventBus().publish(
        Events.allTokensRevoked({
          userId,
          revokedBy: userId,
          tokenCount: count
        })
      );
    }

    return count;
  }

  async getUserTokens(userId: number): Promise<OAuthToken[]> {
    return this.tokenDao.findActiveByUserId(userId);
  }
}
