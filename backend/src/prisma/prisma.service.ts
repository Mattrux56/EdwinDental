import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      // La aplicación puede arrancar sin conexión de BD y conectarse cuando se configure .env
      this.logger.warn(`No se pudo conectar a la base de datos: ${error instanceof Error ? error.message : error}`);
    }
  }
}
