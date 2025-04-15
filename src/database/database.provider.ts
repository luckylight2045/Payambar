import { MongooseModule } from '@nestjs/mongoose';

export const databaseProviders = [
  MongooseModule.forRootAsync({
    useFactory: () => ({
      uri: `mongodb://admin:password@mongo:27017/mongo?authSource=admin`,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
    }),
  }),
];
