import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VectorService } from './vector/vector.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, VectorService],
})
export class AppModule {}
