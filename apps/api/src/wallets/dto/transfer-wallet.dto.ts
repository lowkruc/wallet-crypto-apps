import { IsNumber, IsPositive, IsString, Matches } from 'class-validator';
import { USERNAME_REGEX } from '../../auth/dto/register.dto';

export class TransferWalletDto {
  @IsString()
  @Matches(USERNAME_REGEX, {
    message:
      'recipientUsername must be 3-30 characters using letters, numbers, or underscores',
  })
  recipientUsername!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
