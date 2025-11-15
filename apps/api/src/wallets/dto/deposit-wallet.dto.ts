import { IsNumber, IsPositive, IsString } from 'class-validator';

export class DepositWalletDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  currency!: string;
}
