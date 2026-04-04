import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { users } from '../database/schema.js';
import type { RegisterDto, LoginDto } from './auth.schemas.js';

export interface AuthResponse {
  access_token: string;
}

interface JwtPayload {
  sub: string;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Email is already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const [user] = await this.db
      .insert(users)
      .values({ email: dto.email, passwordHash })
      .returning({ id: users.id });

    return this.signToken({ sub: user.id });
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const rows = await this.db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = rows[0];
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.signToken({ sub: user.id });
  }

  private signToken(payload: JwtPayload): AuthResponse {
    return { access_token: this.jwtService.sign(payload) };
  }
}
