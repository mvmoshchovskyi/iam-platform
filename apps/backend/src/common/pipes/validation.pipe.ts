import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';

const flatten = (errors: ValidationError[], parent = ''): { field: string; messages: string[] }[] =>
  errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, messages: Object.values(e.constraints) }] : [];
    return [...own, ...flatten(e.children ?? [], field)];
  });

/** Strict validation: unknown properties are rejected and errors come back field-by-field. */
export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException({
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        errors: flatten(errors),
      }),
  });
