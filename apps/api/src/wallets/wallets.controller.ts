import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Wallet } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload';
import { WalletsService } from './wallets.service';

@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  listMine(@CurrentUser() user: JwtPayload): Promise<Wallet[]> {
    return this.walletsService.listMine(user.sub);
  }
}
