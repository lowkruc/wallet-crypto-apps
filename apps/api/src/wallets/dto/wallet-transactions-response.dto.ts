import { TransactionType } from '@prisma/client';
import { WalletDto } from './wallet.dto';

export class WalletTransactionDto {
  id!: string;
  type!: TransactionType;
  amount!: string;
  currency!: string;
  fromWalletId?: string | null;
  toWalletId?: string | null;
  createdAt!: Date;
}

export class WalletTransactionsResponseDto {
  wallet!: WalletDto;
  transactions!: WalletTransactionDto[];
}
