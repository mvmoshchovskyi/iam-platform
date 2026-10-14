import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/transformers';

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'correct-Horse-battery-42',
    minLength: 10,
    maxLength: 72,
    description: 'Must score ≥ 3 on zxcvbn (bcrypt uses the first 72 bytes)',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}
