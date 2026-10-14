import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ProblemDetailsDto } from '../dto/problem-details.dto';

/** Documents RFC 7807 error responses for the given status codes. */
export const ApiProblem = (...statuses: number[]) =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({ status, type: ProblemDetailsDto, description: 'application/problem+json' }),
    ),
  );
