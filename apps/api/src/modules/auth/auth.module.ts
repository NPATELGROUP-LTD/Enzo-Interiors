import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthController, GoogleAuthService } from './google';
import { TwoFactorService } from './two-factor';
import { UsersController, UsersService } from './users';

/** The signing key, or a loud failure at boot. */
function mustHaveSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set to at least 32 characters. Generate one with: openssl rand -base64 48',
    );
  }
  return secret;
}

/**
 * Registers JwtModule globally so JwtAuthGuard (an APP_GUARD in AppModule) and
 * the WebSocket gateway can both verify tokens without re-importing it.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // No fallback on purpose. A default signing key that ships in the
        // repository is a key everyone has, and it would let anyone mint a
        // token with role: Admin. Refusing to boot is the correct failure.
        secret: mustHaveSecret(config),
        signOptions: {
          // jsonwebtoken types this as a `ms` StringValue template literal
          // ("12h", "7d", ...). It comes from env as a plain string, so the
          // assertion is where that unavoidable widening is acknowledged.
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '12h') as `${number}h`,
        },
      }),
    }),
  ],
  controllers: [AuthController, GoogleAuthController, UsersController],
  providers: [AuthService, TwoFactorService, GoogleAuthService, UsersService],
})
export class AuthModule {}
