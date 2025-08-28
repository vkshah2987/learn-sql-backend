import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard) // Protect all admin endpoints with JWT authentication
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('seed')
  async seedLessons() {
    return await this.adminService.seedLessons();
  }

  @Post('reset')
  async resetDatabase() {
    return await this.adminService.resetDatabase();
  }
}
