import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VectorService } from './vector/vector.service';
import { SessionService } from './session/session.service';
import { TtsService } from './tts/tts.service';
import { OpenAiService } from './open-ai/open-ai.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, VectorService, SessionService, TtsService, OpenAiService],
})
export class AppModule {}
