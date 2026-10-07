import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CuentasCobroController } from './cuentas-cobro.controller';
import { CuentasCobroService } from './cuentas-cobro.service';

@Module({
  imports: [PrismaModule],
  controllers: [CuentasCobroController],
  providers: [CuentasCobroService],
})
export class CuentasCobroModule {}
