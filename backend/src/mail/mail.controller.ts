import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Delete,
  HttpException,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MailService } from './mail.service';
import { SendEmailDto } from './dto/send-email.dto';

type SuccessResponse = { success: true; messageId: string };

interface ErrorResponse {
  success: false;
  error: string;
  statusCode: number;
}

@Controller('api/mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendEmail(
    @Body() dto: SendEmailDto,
  ): Promise<SuccessResponse | ErrorResponse> {
    try {
      const result = await this.mailService.sendEmail(dto);

      if (result.success) {
        return result as SuccessResponse;
      }

      // Service returned a structured failure (shouldn't normally reach here
      // since the service throws — but handle defensively)
      return {
        success: false,
        error: result.error,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        const status = err.getStatus();
        const response = err.getResponse();
        const message =
          typeof response === 'string'
            ? response
            : (response as { message?: string | string[] }).message
              ? Array.isArray((response as { message: string[] }).message)
                ? (response as { message: string[] }).message.join('; ')
                : String((response as { message: string }).message)
              : err.message;

        return {
          success: false,
          error: message,
          statusCode: status,
        };
      }

      return {
        success: false,
        error: 'An unexpected server error occurred.',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }


  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  async receiveInboundWebhook(@Body() payload: any) {
    const email = await this.mailService.saveInboundEmail(payload);
    return { success: true, id: email.id };
  }

  @Get('inbound')
  async getInboundEmails() {
    const emails = await this.mailService.getInboundEmails();
    return { success: true, emails };
  }

  @Sse('inbound/stream')
  streamInboundEmails(): Observable<MessageEvent> {
    return this.mailService.inboundEmailSubject.asObservable().pipe(
      map((email) => ({
        data: email,
      } as MessageEvent)),
    );
  }

  @Get('sent')
  async getSentEmails() {
    const emails = await this.mailService.getSentEmails();
    return { success: true, emails };
  }
}
