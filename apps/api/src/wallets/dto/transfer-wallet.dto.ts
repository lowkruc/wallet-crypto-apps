import { IsEmail, IsNumber, IsPositive } from 'class-validator';

export class TransferWalletDto {
  @IsEmail()
  recipientEmail!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
