import { GraphQLError } from 'graphql';

import { assertSizeWithinLimit, MAX_IMAGE_BYTES } from '../../../src/modules/media/media.utils';

describe('media.utils', () => {
  it('allows unspecified or small payloads', () => {
    expect(() => assertSizeWithinLimit()).not.toThrow();
    expect(() => assertSizeWithinLimit(MAX_IMAGE_BYTES)).not.toThrow();
  });

  it('throws when payload exceeds limit', () => {
    expect(() => assertSizeWithinLimit(MAX_IMAGE_BYTES + 1)).toThrow(GraphQLError);
    try {
      assertSizeWithinLimit(MAX_IMAGE_BYTES + 5);
    } catch (error) {
      const gqlError = error as GraphQLError;
      expect(gqlError.extensions).toEqual(
        expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE' }),
      );
    }
  });
});