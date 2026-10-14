import { type Type as ClassType } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export class PaginationMetaDto {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMetaDto;
}

export const paginate = <T>(
  items: T[],
  total: number,
  query: PaginationQueryDto,
): Paginated<T> => ({
  items,
  meta: {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  },
});

/** Builds a concrete Swagger schema class for a paginated list of `Item`. */
export function PaginatedDto<T>(Item: ClassType<T>) {
  class PaginatedResponse implements Paginated<T> {
    @ApiProperty({ type: [Item] })
    items: T[];

    @ApiProperty({ type: PaginationMetaDto })
    meta: PaginationMetaDto;
  }
  Object.defineProperty(PaginatedResponse, 'name', { value: `Paginated${Item.name}` });
  return PaginatedResponse;
}
