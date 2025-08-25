import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';
import * as dotenv from 'dotenv';

async function bootstrap() {
  dotenv.config(); // Load .env
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  // app.enableCors({
  //   origin: ['https://digiaiapp.in', 'http://localhost:4200'], // ✅ only allow this domain
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  //   credentials: true, // needed if you use cookies
  // });
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  const server = await app.listen(3000, '0.0.0.0');
  server.setTimeout(600000);
}
bootstrap();
