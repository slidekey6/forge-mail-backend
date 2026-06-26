import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { SendEmailDto } from './dto/send-email.dto';
import * as fs from 'fs';
import { join } from 'path';
import { Subject } from 'rxjs';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

interface SendSuccess {
  success: true;
  messageId: string;
}

interface SendFailure {
  success: false;
  error: string;
}

type SendResult = SendSuccess | SendFailure;

/** Strips HTML tags and collapses whitespace to produce a plain-text fallback. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Retries an async function with exponential back-off.
 * Only retries on network errors or 5xx-style failures; validation errors are
 * rethrown immediately.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      // Do not retry on known validation / business-logic exceptions
      if (
        err instanceof UnprocessableEntityException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 500 → 1000 → 2000
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly defaultFrom: string;
  private readonly inboundFilePath = join(process.cwd(), '.data', 'inbound-emails.json');
  private readonly sentFilePath = join(process.cwd(), '.data', 'sent-emails.json');
  private readonly s3Client?: S3Client;
  private readonly r2Bucket?: string;
  
  public readonly inboundEmailSubject = new Subject<any>();

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException(
        'RESEND_API_KEY is not configured. Check your .env file.',
      );
    }

    this.resend = new Resend(apiKey);
    this.defaultFrom =
      this.config.get<string>('DEFAULT_FROM') ?? 'ABN AMRO <support@abnamro.work.gd>';

    const r2AccountId = this.config.get<string>('R2_ACCOUNT_ID');
    const r2AccessKey = this.config.get<string>('R2_ACCESS_KEY_ID');
    const r2SecretKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    
    if (r2AccountId && r2AccessKey && r2SecretKey) {
      this.r2Bucket = this.config.get<string>('R2_BUCKET_NAME') || 'forgemail-data';
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: r2AccessKey,
          secretAccessKey: r2SecretKey,
        },
      });
      this.logger.log(`☁️ Cloudflare R2 configured for bucket: ${this.r2Bucket}`);
    } else {
      this.logger.log('💾 Using local file system for storage (R2 not configured)');
    }
  }

  async sendEmail(dto: SendEmailDto): Promise<SendResult> {
    const timestamp = new Date().toISOString();
    const from = dto.from || this.defaultFrom;

    this.logger.log(
      `📨 Send attempt — from: ${from} → to: ${dto.to} | subject: "${dto.subject}"`,
    );

    return this.sendViaResend(dto, from, timestamp);
  }


  /* ── S3 Helpers ───────────────────────────────────────────────── */
  private async fetchFromS3(key: string): Promise<any[]> {
    if (!this.s3Client) return [];
    try {
      const command = new GetObjectCommand({ Bucket: this.r2Bucket, Key: key });
      const response = await this.s3Client.send(command);
      const str = await response.Body?.transformToString();
      if (str) return JSON.parse(str);
    } catch (e: any) {
      if (e.name !== 'NoSuchKey') {
        this.logger.error(`Failed to fetch ${key} from R2`, e);
      }
    }
    return [];
  }

  private async uploadToS3(key: string, data: any[]) {
    if (!this.s3Client) return;
    try {
      const command = new PutObjectCommand({
        Bucket: this.r2Bucket,
        Key: key,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
      });
      await this.s3Client.send(command);
    } catch (e) {
      this.logger.error(`Failed to upload ${key} to R2`, e);
    }
  }

  /* ── Inbound Webhooks ─────────────────────────────────────────── */
  async getInboundEmails() {
    if (this.s3Client) return this.fetchFromS3('inbound-emails.json');
    try {
      if (fs.existsSync(this.inboundFilePath)) {
        return JSON.parse(fs.readFileSync(this.inboundFilePath, 'utf8'));
      }
    } catch (e) {
      this.logger.error('Failed to read inbound emails', e);
    }
    return [];
  }

  /* ── Sent Emails ──────────────────────────────────────────────── */
  async getSentEmails() {
    if (this.s3Client) return this.fetchFromS3('sent-emails.json');
    try {
      if (fs.existsSync(this.sentFilePath)) {
        return JSON.parse(fs.readFileSync(this.sentFilePath, 'utf8'));
      }
    } catch (e) {
      this.logger.error('Failed to read sent emails', e);
    }
    return [];
  }

  async saveSentEmail(dto: SendEmailDto, from: string, messageId: string) {
    let emails = await this.getSentEmails();
    const newEmail = {
      id: messageId,
      sentAt: new Date().toISOString(),
      from,
      to: dto.to,
      subject: dto.subject,
      text: dto.text?.trim() || htmlToText(dto.html),
      html: dto.html,
    };
    emails.unshift(newEmail);
    if (emails.length > 100) emails = emails.slice(0, 100);
    
    if (this.s3Client) {
      await this.uploadToS3('sent-emails.json', emails);
    } else {
      if (!fs.existsSync(join(process.cwd(), '.data'))) {
        fs.mkdirSync(join(process.cwd(), '.data'), { recursive: true });
      }
      fs.writeFileSync(this.sentFilePath, JSON.stringify(emails, null, 2));
    }
    return newEmail;
  }

  async saveInboundEmail(payload: any) {
    let emails = await this.getInboundEmails();
    
    // Extract metadata from Resend payload
    const data = payload.data || payload;
    const emailId = data.email_id || payload.id;
    
    let htmlContent = data.html || '';
    let textContent = data.text || '';
    
    // If we only got metadata, fetch full body from Resend API
    if (emailId && payload.type === 'email.received' && !htmlContent && !textContent) {
      try {
        const apiKey = this.config.get<string>('RESEND_API_KEY');
        const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        const fullEmail = await response.json();
        
        if (response.ok && fullEmail) {
          htmlContent = fullEmail.html || htmlContent;
          textContent = fullEmail.text || textContent;
        } else {
          this.logger.warn(`Resend API returned non-OK status: ${response.status} - ${JSON.stringify(fullEmail)}`);
        }
      } catch (err) {
        this.logger.error(`Failed to fetch full email body for ${emailId}`, err);
      }
    }

    // Add new email at the top
    const newEmail = {
      id: emailId || `in-${Date.now()}`,
      receivedAt: data.created_at || new Date().toISOString(),
      from: data.from,
      to: data.to,
      subject: data.subject,
      text: textContent,
      html: htmlContent,
      raw: payload,
    };
    emails.unshift(newEmail);
    
    // Keep only the last 100 emails
    if (emails.length > 100) {
      emails = emails.slice(0, 100);
    }

    if (this.s3Client) {
      await this.uploadToS3('inbound-emails.json', emails);
    } else {
      if (!fs.existsSync(join(process.cwd(), '.data'))) {
        fs.mkdirSync(join(process.cwd(), '.data'), { recursive: true });
      }
      fs.writeFileSync(this.inboundFilePath, JSON.stringify(emails, null, 2));
    }

    // Emit event for SSE
    this.inboundEmailSubject.next(newEmail);
    return newEmail;
  }

  /* ── Resend transport ─────────────────────────────────────────── */
  private async sendViaResend(
    dto: SendEmailDto,
    from: string,
    timestamp: string,
  ): Promise<SendResult> {
    // Derive plain-text body: use explicit override or auto-strip HTML
    const textBody = dto.text?.trim() || htmlToText(dto.html);

    // Reply-To: use explicit override or fall back to the from address
    const replyTo = dto.replyTo?.trim() || from;

    const sendPayload = {
      from,
      to: [dto.to],
      subject: dto.subject,
      html: dto.html,
      text: textBody,
      replyTo,
      headers: {
        'X-Mailer': 'ForgeMail/2.0 (Resend)',
        'X-Priority': '3',             // Normal priority (1=High, 3=Normal, 5=Low)
        'X-Entity-Ref-ID': `fm-${Date.now()}`, // Unique send reference for dedup
      },
      tags: [
        { name: 'provider', value: 'resend' },
        { name: 'app',      value: 'forge-mail' },
        { name: 'env',      value: this.config.get<string>('NODE_ENV') ?? 'development' },
      ],
    };

    const start = Date.now();

    try {
      const { data, error } = await withRetry(
        async () => this.resend.emails.send(sendPayload),
        3,   // max 3 attempts
        500, // base delay 500 ms → 1 s → 2 s
      );

      const elapsed = Date.now() - start;

      if (error) {
        this.logger.error(`❌ Resend API error after ${elapsed}ms: ${JSON.stringify(error)}`);
        throw new UnprocessableEntityException(
          error.message ?? 'Resend rejected the email request.',
        );
      }

      if (!data?.id) {
        throw new InternalServerErrorException(
          'Resend returned an empty response without an ID.',
        );
      }

      this.logger.log(
        `✅ Resend — delivered | id: ${data.id} | replyTo: ${replyTo} | elapsed: ${elapsed}ms`,
      );
      this.saveSentEmail(dto, from, data.id);
      return { success: true, messageId: data.id };
    } catch (err: unknown) {
      if (
        err instanceof UnprocessableEntityException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred.';
      this.logger.error(`💥 Resend unexpected error after ${Date.now() - start}ms: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }


}
