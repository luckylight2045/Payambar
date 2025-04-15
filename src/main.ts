import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Payambar')
    .setDescription('payambar API')
    .setVersion('1.0')
    .addTag('payambar')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const docuemntFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, docuemntFactory);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
