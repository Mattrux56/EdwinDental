import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(compression()); // JSON y archivos del frontend viajan comprimidos
  app.useStaticAssets(frontendDist, {
    setHeaders: (res, path) => {
      // Vite pone un código en el nombre de cada archivo de /assets: se puede guardar un año.
      // El index.html no, para que una versión nueva se vea al recargar.
      if (/[\\/]assets[\\/]/.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  });
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
  await app.listen(process.env.PORT || 3000, '127.0.0.1');
}

bootstrap();
