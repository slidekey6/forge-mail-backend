import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    // Load .env globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Serve the frontend folder at the web root.
    // __dirname in dev/watch = <backend>/src, in prod = <backend>/dist
    // Go up until we reach the email-sender root, then into frontend/
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend'),
      serveRoot: '/',
      exclude: ['/api/(.*)'],
    }),

    MailModule,
  ],
})
export class AppModule { }
