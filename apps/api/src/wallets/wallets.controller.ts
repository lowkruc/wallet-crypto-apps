import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload';
import { WalletsService } from './wallets.service';
import { WalletDto } from './dto/wallet.dto';
import {
  WalletTransactionDto,
  WalletTransactionsResponseDto,
} from './dto/wallet-transactions-response.dto';
import { DepositWalletDto } from './dto/deposit-wallet.dto';
import { TransferWalletDto } from './dto/transfer-wallet.dto';

@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  async listMine(@CurrentUser() user: JwtPayload): Promise<WalletDto[]> {
    const wallets = await this.walletsService.listMine(user.sub);
    return wallets.map((wallet) => ({
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      balance: wallet.balance.toString(),
      createdAt: wallet.createdAt,
    }));
  }

  @Get(':id/transactions')
  async listTransactions(
    @Param('id') walletId: string,
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ): Promise<WalletTransactionsResponseDto> {
    const parsedLimit = Number(limit ?? 20);
    const take =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 20;
    const result = await this.walletsService.listTransactions(
      walletId,
      user.sub,
      take,
    );
    return {
      wallet: {
        id: result.wallet.id,
        userId: result.wallet.userId,
        balance: result.wallet.balance.toString(),
        currency: result.wallet.currency,
        createdAt: result.wallet.createdAt,
      },
      transactions: result.transactions.map<WalletTransactionDto>((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.toString(),
        currency: tx.currency,
        fromWalletId: tx.fromWalletId,
        toWalletId: tx.toWalletId,
        createdAt: tx.createdAt,
      })),
    };
  }

  @Post(':id/deposit')
  async deposit(
    @Param('id') walletId: string,
    @Body() dto: DepositWalletDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.walletsService.deposit(
      walletId,
      user.sub,
      dto.amount,
      dto.currency,
    );
    return {
      wallet: {
        id: result.wallet.id,
        userId: result.wallet.userId,
        balance: result.wallet.balance.toString(),
        currency: result.wallet.currency,
        createdAt: result.wallet.createdAt,
      },
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: result.transaction.amount.toString(),
        currency: result.transaction.currency,
        createdAt: result.transaction.createdAt,
      },
    };
  }

  @Post('transfer')
  async transfer(
    @Body() dto: TransferWalletDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.walletsService.transfer(
      user.sub,
      user.username,
      user.walletId,
      dto.recipientUsername,
      dto.amount,
    );

    return {
      fromWallet: {
        id: result.fromWallet.id,
        userId: result.fromWallet.userId,
        balance: result.fromWallet.balance.toString(),
        currency: result.fromWallet.currency,
        createdAt: result.fromWallet.createdAt,
      },
      toWallet: {
        id: result.toWallet.id,
        userId: result.toWallet.userId,
        balance: result.toWallet.balance.toString(),
        currency: result.toWallet.currency,
        createdAt: result.toWallet.createdAt,
      },
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: result.transaction.amount.toString(),
        currency: result.transaction.currency,
        fromWalletId: result.transaction.fromWalletId,
        toWalletId: result.transaction.toWalletId,
        createdAt: result.transaction.createdAt,
      },
    };
  }
}
