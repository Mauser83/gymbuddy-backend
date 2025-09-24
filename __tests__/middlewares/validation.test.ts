jest.mock('class-transformer', () => ({
  plainToInstance: jest.fn(),
}));

jest.mock('class-validator', () => ({
  validate: jest.fn(),
}));

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GraphQLError } from 'graphql';

import { validateInput } from '../../src/middlewares/validation';

describe('validateInput', () => {
  const plainToInstanceMock = jest.mocked(plainToInstance);
  const validateMock = jest.mocked(validate);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes when validation returns no errors', async () => {
    class TestDto {}

    const dtoInstance = { transformed: true };
    plainToInstanceMock.mockReturnValue(dtoInstance);
    validateMock.mockResolvedValue([]);

    await expect(validateInput({ input: 'value' }, TestDto)).resolves.toBeUndefined();

    expect(plainToInstanceMock).toHaveBeenCalledWith(TestDto, { input: 'value' });
    expect(validateMock).toHaveBeenCalledWith(dtoInstance);
  });

  it('throws a GraphQLError with aggregated constraint messages', async () => {
    class TestDto {}

    const validationErrors = [
      { constraints: { first: 'First message' } },
      { constraints: { second: 'Second message', third: 'Third message' } },
      { constraints: undefined },
    ] as any;

    plainToInstanceMock.mockReturnValue({});
    validateMock.mockResolvedValue(validationErrors);

    let caughtError: unknown;
    try {
      await validateInput({ input: 'invalid' }, TestDto);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(GraphQLError);
    const graphQLError = caughtError as GraphQLError;
    expect(graphQLError.message).toBe(
      'Validation failed: First message, Second message, Third message',
    );
    expect(graphQLError.extensions).toEqual(
      expect.objectContaining({
        code: 'BAD_USER_INPUT',
        validationErrors,
      }),
    );

    expect(plainToInstanceMock).toHaveBeenCalledWith(TestDto, { input: 'invalid' });
    expect(validateMock).toHaveBeenCalledWith({});
  });
});
