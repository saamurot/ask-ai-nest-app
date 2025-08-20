import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VectorService } from './vector/vector.service';
import { SessionService } from './session/session.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, VectorService, SessionService],
})
export class AppModule {}
