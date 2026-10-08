import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  app.useStaticAssets(frontendDist);
  app.use((request, response, next) => {
    if (
      request.method === 'GET' &&
      !request.path.startsWith('/api') &&
      !/\.[A-Za-z0-9]{1,8}$/.test(request.path) && // un .js o .png inexistente debe dar 404, no HTML

      request.accepts('html')
    ) {
      response.sendFile(join(frontendDist, 'index.html'));
      return;
    }
    next();
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors();
  await app.listen(process.env.PORT || 3000, '127.0.0.1');
}

bootstrap();
