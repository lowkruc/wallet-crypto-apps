import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponse } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();
    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name,
          passwordHash,
          wallets: {
            create: {
              currency: 'IDR',
            },
          },
        },
        include: {
          wallets: {
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      });

      const wallet = user.wallets.at(0);
      if (!wallet) {
        throw new BadRequestException('Failed to provision wallet');
      }
      return this.buildAuthResponse(user, wallet.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        wallets: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const wallet = user.wallets.at(0);
    if (!wallet) {
      throw new UnauthorizedException('Wallet not found');
    }

    return this.buildAuthResponse(user, wallet.id);
  }

  private buildAuthResponse(user: User, walletId: string): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      walletId,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        walletId,
      },
    };
  }
}
