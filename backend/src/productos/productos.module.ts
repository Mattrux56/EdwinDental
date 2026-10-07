import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductosController } from './productos.controller';

@Module({ imports: [PrismaModule], controllers: [ProductosController] })
export class ProductosModule {}
