import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { VerifiedJwtPayload } from './auth.types.js';

interface RequestWithUser {
  headers: { authorization?: string };
  user?: { id: string };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<VerifiedJwtPayload>(token);
      request.user = { id: payload.sub };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractToken(request: RequestWithUser): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;

    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
