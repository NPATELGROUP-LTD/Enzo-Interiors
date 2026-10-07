import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** The content importer stamps entries with this name and only refreshes
 *  entries still carrying it on deploy, so no person may use it. */
export const NOT_IMPORTER = /^(?!\s*content import\s*$)/i;

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Enter your password' })
  @MaxLength(200)
  password!: string;

  /** From an earlier "remember this device": skips the code while it lasts. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceToken?: string;
}

/** The half-finished sign-in the password step handed back. */
export class ChallengeDto {
  @IsString()
  @MaxLength(2000)
  challenge!: string;
}

export class ChallengeCodeDto extends ChallengeDto {
  @IsString()
  @MinLength(1, { message: 'Enter the code.' })
  @MaxLength(20)
  code!: string;
}

export class CodeDto extends ChallengeCodeDto {
  /** Skip the code on this browser for 30 days. */
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

/** Linking Google needs the password again, not just a session. */
export class GoogleLinkDto {
  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  @MaxLength(200)
  password!: string;
}

/** The one-time code Google sign-in hands the admin in its redirect. */
export class GoogleExchangeDto {
  @IsString()
  @MaxLength(100)
  code!: string;
}

/** One rule for every new password: change and reset alike. */
class NewPasswordDto {
  @IsString()
  @MinLength(12, { message: 'Use at least 12 characters for the new password.' })
  // bcrypt only reads the first 72 bytes; a longer value would be silently cut.
  @MaxLength(72, { message: 'Use at most 72 characters for the new password.' })
  new_password!: string;
}

export class ChangePasswordDto extends NewPasswordDto {
  @IsString()
  @MaxLength(200)
  current_password!: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto extends NewPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(100)
  token!: string;
}

export class ProfileDto {
  @IsString()
  @MinLength(2, { message: 'Enter your name.' })
  @MaxLength(120)
  @Matches(NOT_IMPORTER, { message: 'Choose a different name.' })
  name!: string;
}
