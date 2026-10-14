import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/transformers';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token from the verification link' })
  @IsString()
  @Length(20, 128)
  token: string;
}

export class EmailDto {
  @ApiProperty({ example: 'jane@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;
}
