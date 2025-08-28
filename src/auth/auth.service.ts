import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  async register(email: string, password: string, displayName?: string) {
    const hashed = await bcrypt.hash(password, 10);
    try {
      const user = await this.prisma.user.create({
        data: { email, password: hashed, displayName },
        select: { id: true, email: true, displayName: true, createdAt: true },
      });
      const token = await this.signToken(user.id);
      return { user, token };
    } catch (err: any) {
      // Prisma unique violation code P2002
      if (err?.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw err;
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = await this.signToken(user.id);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      token,
    };
  }

  async signToken(userId: number) {
    return this.jwtService.signAsync({ sub: userId });
  }
}
