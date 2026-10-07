import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RemisionesController } from './remisiones.controller';
import { RemisionesService } from './remisiones.service';

@Module({
  imports: [PrismaModule],
  controllers: [RemisionesController],
  providers: [RemisionesService],
})
export class RemisionesModule {}
