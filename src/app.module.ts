import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModdule } from './user/user.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://admin:password@localhost:27017/', {
      dbName: 'mongo',
    }),
    UserModdule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
