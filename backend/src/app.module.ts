import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { SongsModule } from './songs/songs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    SongsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
