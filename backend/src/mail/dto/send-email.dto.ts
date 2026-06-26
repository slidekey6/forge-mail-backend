import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Accepts: "user@example.com"  OR  "Display Name <user@example.com>"
const FROM_RE =
  /^(?:[^<>]+<[^\s@]+@[^\s@]+\.[^\s@]+>|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

// Accepts plain email OR "Name <email>"
const EMAIL_OR_NAMED_RE =
  /^(?:[^<>]+<[^\s@]+@[^\s@]+\.[^\s@]+>|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

export class SendEmailDto {
  @IsString()
  @IsNotEmpty({ message: 'from is required' })
  @Matches(FROM_RE, {
    message:
      'from must be a valid email or "Display Name <email@domain.com>" format',
  })
  from!: string;

  @IsString()
  @IsNotEmpty({ message: 'to is required' })
  @Matches(EMAIL_OR_NAMED_RE, {
    message:
      'to must be a valid email or "Display Name <email@domain.com>" format',
  })
  to!: string;

  @IsString()
  @IsNotEmpty({ message: 'subject is required' })
  @MaxLength(255, { message: 'subject must not exceed 255 characters' })
  subject!: string;

  @IsString()
  @IsNotEmpty({ message: 'html body is required' })
  html!: string;

  /** Optional plain-text body. Auto-generated from html if omitted. */
  @IsOptional()
  @IsString()
  text?: string;

  /** Optional Reply-To address. Defaults to the `from` address. */
  @IsOptional()
  @IsString()
  @Matches(FROM_RE, {
    message:
      'replyTo must be a valid email or "Display Name <email@domain.com>" format',
  })
  replyTo?: string;


}
