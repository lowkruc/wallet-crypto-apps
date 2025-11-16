import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/i;

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @Matches(USERNAME_REGEX, {
    message:
      'username must be 3-30 characters using letters, numbers, or underscores',
  })
  username!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_REGEX, {
    message: 'password must contain at least one letter and one number',
  })
  password!: string;
}
