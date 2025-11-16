import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload';
import { AnalyticsService } from './analytics.service';
import { UserTopTransactionsDto } from './dto/top-transactions.dto';
import { TopUsersResponseDto } from './dto/top-users.dto';

const parseDateParam = (value?: string): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('users/:id/top-transactions')
  async topTransactions(
    @Param('id') userId: string,
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<UserTopTransactionsDto> {
    if (userId !== user.sub) {
      throw new ForbiddenException(
        'You can only view analytics for your own account',
      );
    }
    const parsedLimit = limit ? Number(limit) : undefined;
    const range = {
      start: parseDateParam(startDate),
      end: parseDateParam(endDate),
    };
    return this.analyticsService.getUserTopTransactions(
      userId,
      parsedLimit,
      range,
    );
  }

  @Get('top-users')
  async topUsers(
    @Query('limit') limit: string | undefined,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TopUsersResponseDto> {
    const parsedLimit = limit ? Number(limit) : undefined;
    const range = {
      start: parseDateParam(startDate),
      end: parseDateParam(endDate),
    };
    return this.analyticsService.getTopUsers(parsedLimit, range);
  }
}
