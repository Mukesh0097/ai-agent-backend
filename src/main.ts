import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// import { BaseWsExceptionFilter } from '@nestjs/websockets';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // app.useGlobalFilters(new BaseWsExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
