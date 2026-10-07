import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientesController } from './clientes.controller';

@Module({ imports: [PrismaModule], controllers: [ClientesController] })
export class ClientesModule {}
