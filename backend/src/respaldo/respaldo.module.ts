import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RespaldoController } from './respaldo.controller';

@Module({ imports: [PrismaModule], controllers: [RespaldoController] })
export class RespaldoModule {}
