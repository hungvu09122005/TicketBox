import { Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../mail/mail.service';
import { UsersRepository, CreateUserData, FindUsersOptions, FindUsersResult, UpdateOwnProfileData } from './users.repository';
import { User } from './entities/user.entity';
import { AuthClientApp, AuthActionPurpose } from '../auth/auth.types';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

/**
 * UsersService — application service layer for user data.
 * This is the ONLY exported surface of UsersModule.
 * Other modules (Auth, Admin) depend on this service, never on UsersRepository.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly logger: Logger,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async updateOwnProfile(userId: string, data: UpdateOwnProfileData): Promise<User> {
    const currentUser = await this.usersRepository.findById(userId);
    if (!currentUser) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (typeof data.name === 'string') {
      data.name = data.name.trim();
    }

    const updated = await this.usersRepository.updateOwnProfile(userId, data);
    if (!updated) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return updated;
  }

  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    nextPassword: string,
  ): Promise<User> {
    const currentUser = await this.usersRepository.findById(userId);
    if (!currentUser) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const isValid = await bcrypt.compare(currentPassword, currentUser.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const nextPasswordHash = await bcrypt.hash(nextPassword, 12);
    await this.usersRepository.updatePasswordHash(userId, nextPasswordHash);
    await this.invalidatePermissionCache(userId);

    const updated = await this.usersRepository.findById(userId);
    if (!updated) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return updated;
  }

  async createUser(data: CreateUserData): Promise<User> {
    return this.usersRepository.create(data);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.usersRepository.updatePasswordHash(userId, passwordHash);
  }

  async findMany(options: FindUsersOptions = {}): Promise<FindUsersResult> {
    return this.usersRepository.findMany(options);
  }

  /**
   * Called by RBAC management when Admin changes a user's roles.
   * Increments permissionVersion to invalidate Redis permission cache.
   */
  async invalidatePermissionCache(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (user) {
      await this.invalidatePermissionCaches([user]);
    }
  }

  async refreshPermissionVersionsForRole(roleName: string, adminId: string): Promise<void> {
    const users = await this.usersRepository.findManyByRoleName(roleName);
    await this.invalidatePermissionCaches(users);

    this.logger.log({
      msg: 'Audit: Permission version refreshed for role',
      roleName,
      adminId,
      affectedUserIds: users.map((user) => user.id),
      affectedCount: users.length,
    });
  }

  async updateRoles(userId: string, roles: string[], adminId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Update in DB (increments permission_version)
    await this.usersRepository.updateRoles(userId, roles);
    await this.invalidatePermissionCaches([user]);

    this.logger.log({
      msg: 'Audit: User roles updated',
      targetUserId: userId,
      adminId,
      oldRoles: user.roles,
      newRoles: roles,
      oldVersion: user.permissionVersion,
      newVersion: user.permissionVersion + 1,
    });

    return (await this.usersRepository.findById(userId))!;
  }

  async updateActiveStatus(
    userId: string,
    isActive: boolean,
    adminId: string,
    sendActivationEmail = true,
  ): Promise<User> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const updatedUser = await this.usersRepository.updateActiveStatus(userId, isActive);
    if (!updatedUser) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    await this.invalidatePermissionCaches([user]);

    this.logger.log({
      msg: 'Audit: User active status updated',
      targetUserId: userId,
      adminId,
      oldIsActive: user.isActive,
      newIsActive: isActive,
    });

    if (sendActivationEmail && !user.isActive && isActive) {
      await this.sendActivationEmail(updatedUser, 'admin');
    }

    return (await this.usersRepository.findById(userId)) ?? updatedUser;
  }

  async sendActivationEmail(user: User, app: AuthClientApp): Promise<void> {
    const token = await this.createActionToken(user, 'activation');
    const frontendUrl = this.getFrontendUrl(app);
    const link = `${frontendUrl.replace(/\/$/, '')}/activate-account?token=${encodeURIComponent(token)}`;

    await this.sendEmailBestEffort({
      to: user.email,
      subject: 'Kích hoạt tài khoản TicketBox',
      html: this.buildEmailHtml({
        title: 'Kích hoạt tài khoản',
        heading: 'Kích hoạt tài khoản TicketBox',
        description: 'Nhấn nút bên dưới để kích hoạt tài khoản và tiếp tục đăng nhập.',
        buttonLabel: 'Kích hoạt tài khoản',
        buttonUrl: link,
        footerNote: 'Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.',
      }),
      text: `Kích hoạt tài khoản TicketBox: ${link}`,
    });
  }

  async sendPasswordResetEmail(user: User, app: AuthClientApp): Promise<void> {
    const token = await this.createActionToken(user, 'password-reset');
    const frontendUrl = this.getFrontendUrl(app);
    const link = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

    await this.sendEmailBestEffort({
      to: user.email,
      subject: 'Đặt lại mật khẩu TicketBox',
      html: this.buildEmailHtml({
        title: 'Đặt lại mật khẩu',
        heading: 'Đặt lại mật khẩu TicketBox',
        description: 'Nhấn nút bên dưới để tạo mật khẩu mới cho tài khoản của bạn.',
        buttonLabel: 'Đặt lại mật khẩu',
        buttonUrl: link,
        footerNote: 'Liên kết này chỉ dùng một lần và sẽ hết hạn sau một thời gian ngắn.',
      }),
      text: `Đặt lại mật khẩu TicketBox: ${link}`,
    });
  }

  private async invalidatePermissionCaches(users: User[]): Promise<void> {
    if (users.length === 0) {
      return;
    }

    await Promise.all(
      users.map(async (user) => {
        const cacheKey = `rbac:user:${user.id}:v${user.permissionVersion}`;
        await this.cache.del(cacheKey);
      }),
    );

    await this.usersRepository.incrementPermissionVersionsByIds(users.map((user) => user.id));
  }

  private async createActionToken(user: User, purpose: AuthActionPurpose): Promise<string> {
    const token = uuidv4();
    const expiresIn =
      purpose === 'activation'
        ? this.configService.get<string>('app.jwt.activationExpiresIn') ?? '24h'
        : this.configService.get<string>('app.jwt.passwordResetExpiresIn') ?? '1h';

    const cacheKey = `auth:${purpose}:${token}`;
    const ttlMs = this.getActionTokenTtlMs(expiresIn);
    await this.cache.set(cacheKey, user.id, ttlMs);

    return token;
  }

  private getActionTokenTtlMs(expiresIn: string): number {
    const match = expiresIn.trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
    if (!match) {
      return 60 * 60 * 1000;
    }

    const value = Number(match[1]);
    const unit = (match[2] ?? 's').toLowerCase();

    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return value * 1000;
    }
  }

  private getFrontendUrl(app: AuthClientApp): string {
    return app === 'admin'
      ? this.configService.get<string>('app.frontendAdminUrl') ?? 'http://localhost:3002'
      : this.configService.get<string>('app.frontendAudienceUrl') ?? 'http://localhost:3000';
  }

  private async sendEmailBestEffort(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    try {
      await this.mailService.sendEmail(params);
    } catch (error) {
      this.logger.warn({
        msg: 'Email delivery failed',
        to: params.to,
        subject: params.subject,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildEmailHtml(params: {
    title: string;
    heading: string;
    description: string;
    buttonLabel: string;
    buttonUrl: string;
    footerNote: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; background: #f7f4ee; padding: 24px; color: #1f1f1f;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #eadfc8; border-radius: 20px; padding: 32px;">
          <p style="margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.18em; color: #8a7f6c; font-size: 12px;">${params.title}</p>
          <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2;">${params.heading}</h1>
          <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.7; color: #5d5549;">${params.description}</p>
          <a href="${params.buttonUrl}" style="display: inline-block; background: #1c1c1c; color: #ffffff; text-decoration: none; border-radius: 999px; padding: 14px 22px; font-weight: 600;">
            ${params.buttonLabel}
          </a>
          <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.6; color: #8a7f6c;">${params.footerNote}</p>
        </div>
      </div>
    `;
  }
}
