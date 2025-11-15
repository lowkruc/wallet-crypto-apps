import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listTransactions(walletId: string, currentUserId: string, take = 20) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId: currentUserId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [{ fromWalletId: walletId }, { toWalletId: walletId }],
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return { wallet, transactions };
  }

  async deposit(
    walletId: string,
    currentUserId: string,
    amount: number,
    currency: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, userId: currentUserId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const [updatedWallet, transaction] = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.wallet.update({
          where: { id: walletId },
          data: {
            balance: wallet.balance.plus(amount),
          },
        });

        const newTransaction = await tx.transaction.create({
          data: {
            type: 'DEPOSIT',
            amount,
            currency,
            toWalletId: walletId,
          },
        });

        return [updated, newTransaction];
      },
    );

    return { wallet: updatedWallet, transaction };
  }
}
