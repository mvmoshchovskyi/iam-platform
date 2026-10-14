import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FieldErrorDto {
  @ApiProperty({ example: 'email' })
  field: string;

  @ApiProperty({ example: ['email must be an email'] })
  messages: string[];
}

/** RFC 7807 Problem Details body returned for every error. */
export class ProblemDetailsDto {
  @ApiProperty({ example: 'https://httpstatuses.io/400' })
  type: string;

  @ApiProperty({ example: 'Bad Request' })
  title: string;

  @ApiProperty({ example: 400 })
  status: number;

  @ApiProperty({ example: 'Validation failed' })
  detail: string;

  @ApiProperty({ example: '/api/auth/login' })
  instance: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-...' })
  traceId?: string;

  @ApiPropertyOptional({
    example: 'INVALID_CREDENTIALS',
    description: 'Machine-readable error code',
  })
  code?: string;

  @ApiPropertyOptional({ type: [FieldErrorDto] })
  errors?: FieldErrorDto[];

  @ApiPropertyOptional({ example: 30, description: 'Seconds until the request may be retried' })
  retryAfter?: number;
}
