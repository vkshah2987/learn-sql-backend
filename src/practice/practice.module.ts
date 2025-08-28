import { Module } from '@nestjs/common';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ValidatorModule } from '../validator/validator.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AuthModule, ValidatorModule, AIModule],
  controllers: [PracticeController],
  providers: [PracticeService],
  exports: [PracticeService],
})
export class PracticeModule {}
