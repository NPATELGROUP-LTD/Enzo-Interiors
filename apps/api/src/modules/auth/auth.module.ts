import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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
        secret: config.get<string>('JWT_SECRET') ?? 'enzo-interiors-prototype-secret',
        signOptions: {
          // jsonwebtoken types this as a `ms` StringValue template literal
          // ("12h", "7d", ...). It comes from env as a plain string, so the
          // assertion is where that unavoidable widening is acknowledged.
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '12h') as `${number}h`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
