import type { Request } from 'express';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type JwtFromRequestFunction } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload';

const bearerExtractor: JwtFromRequestFunction = (
  request: Request | undefined,
) => {
  const authHeader = request?.headers?.authorization;
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const configuredSecret = configService.get<string>('JWT_SECRET');
    const secret =
      typeof configuredSecret === 'string' ? configuredSecret : 'dev-secret';

    super({
      jwtFromRequest: bearerExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
