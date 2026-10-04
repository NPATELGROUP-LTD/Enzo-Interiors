import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
