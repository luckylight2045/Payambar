import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://admin:password@localhost:27017/', {
      dbName: 'mongo',
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 2,
      waitQueueTimeoutMS: 5000,
    }),
    UserModule,
    AuthModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
