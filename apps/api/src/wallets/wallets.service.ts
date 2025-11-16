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

  async transfer(
    currentUserId: string,
    currentUserEmail: string,
    walletId: string,
    recipientEmail: string,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const normalizedRecipientEmail = recipientEmail.trim().toLowerCase();
    const normalizedCurrentEmail = currentUserEmail.trim().toLowerCase();

    if (normalizedRecipientEmail === normalizedCurrentEmail) {
      throw new BadRequestException('You cannot transfer to yourself');
    }

    const [wallet, recipient] = await Promise.all([
      this.prisma.wallet.findFirst({
        where: { id: walletId, userId: currentUserId },
      }),
      this.prisma.user.findUnique({
        where: { email: normalizedRecipientEmail },
        include: {
          wallets: {
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      }),
    ]);

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (!recipient || recipient.wallets.length === 0) {
      throw new NotFoundException('Recipient not found');
    }

    if (recipient.id === currentUserId) {
      throw new BadRequestException('You cannot transfer to yourself');
    }

    const recipientWallet = recipient.wallets[0];

    const { fromWallet, toWallet, transaction } =
      await this.prisma.$transaction(async (tx) => {
        const debitResult = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            userId: currentUserId,
            balance: { gte: amount },
          },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });

        if (debitResult.count === 0) {
          throw new BadRequestException('Insufficient funds');
        }

        const [updatedSender, updatedRecipient, createdTransaction] =
          await Promise.all([
            tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } }),
            tx.wallet.update({
              where: { id: recipientWallet.id },
              data: {
                balance: {
                  increment: amount,
                },
              },
            }),
            tx.transaction.create({
              data: {
                type: 'TRANSFER',
                amount,
                currency: wallet.currency,
                fromWalletId: wallet.id,
                toWalletId: recipientWallet.id,
              },
            }),
          ]);

        return {
          fromWallet: updatedSender,
          toWallet: updatedRecipient,
          transaction: createdTransaction,
        };
      });

    return { fromWallet, toWallet, transaction };
  }
}
