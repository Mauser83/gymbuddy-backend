import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { GraphQLError } from 'graphql';

export async function validateInput<T extends object>(
  input: unknown,
  dtoClass: new () => T,
): Promise<void> {
  const dto = plainToInstance(dtoClass, input);
  const errors: ValidationError[] = await validate(dto);

  if (errors.length > 0) {
    const message = errors
      .map((error: ValidationError) => (error.constraints ? Object.values(error.constraints) : []))
      .flat()
      .join(', ');
    throw new GraphQLError(`Validation failed: ${message}`, {
      extensions: {
        code: 'BAD_USER_INPUT',
        validationErrors: errors,
      },
    });
  }
}
