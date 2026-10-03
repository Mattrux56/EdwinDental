import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Si el frontend está compilado, se sirve desde el mismo puerto (sin CORS ni segundo servidor)
  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  if (existsSync(frontendDist)) app.useStaticAssets(frontendDist);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  Logger.log(`LabTrace lista en http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
