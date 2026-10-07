import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { CasesModule } from './cases/cases.module';
import { ClientesModule } from './clientes/clientes.module';
import { CuentasCobroModule } from './cuentas-cobro/cuentas-cobro.module';
import { ProductosModule } from './productos/productos.module';
import { RemisionesModule } from './remisiones/remisiones.module';
import { RespaldoModule } from './respaldo/respaldo.module';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { RuntimeController } from './runtime/runtime.controller';
import { RuntimePresenceService } from './runtime/runtime-presence.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
    }),
    PrismaModule,
    SupabaseModule,
    CasesModule,
    ClientesModule,
    CuentasCobroModule,
    RespaldoModule,
    ProductosModule,
    RemisionesModule,
  ],
  controllers: [RuntimeController],
  providers: [RuntimePresenceService],
})
export class AppModule {}
