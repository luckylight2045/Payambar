import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Payambar')
    .setDescription('payambar API')
    .setVersion('1.0')
    .addTag('payambar')
    .build();

  const docuemntFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, docuemntFactory);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
