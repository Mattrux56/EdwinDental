import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [CasesController],
  providers: [CasesService],
})
export class CasesModule {}
