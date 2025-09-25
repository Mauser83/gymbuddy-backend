import { pubsub } from '../../../src/graphql/rootResolvers';
import { SubscriptionResolvers } from '../../../src/graphql/subscription.resolvers';

const mockAsyncIterable = jest.spyOn(pubsub, 'asyncIterableIterator');

describe('SubscriptionResolvers', () => {
  beforeEach(() => {
    mockAsyncIterable.mockReset();
  });

  afterAll(() => {
    mockAsyncIterable.mockRestore();
  });

  it('maps subscription fields to their pubsub topics', () => {
    const expectedTopics = {
      userRoleUpdated: ['USER_ROLE_UPDATED'],
      gymApproved: ['GYM_APPROVED'],
      userUpdated: ['USER_UPDATED'],
      gymCreated: ['GYM_CREATED'],
    } as const;

    for (const field of Object.keys(expectedTopics)) {
      const resolver = (
        SubscriptionResolvers.Subscription as Record<
          string,
          { subscribe: () => ReturnType<typeof pubsub.asyncIterableIterator> }
        >
      )[field];
      expect(typeof resolver.subscribe).toBe('function');

      const sentinel = Symbol(field) as unknown as ReturnType<typeof pubsub.asyncIterableIterator>;
      mockAsyncIterable.mockReturnValueOnce(sentinel);

      const iterator = resolver.subscribe();
      expect(iterator).toBe(sentinel);
    }

    expect(mockAsyncIterable).toHaveBeenCalledTimes(Object.keys(expectedTopics).length);
    expect(mockAsyncIterable.mock.calls).toEqual(
      Object.values(expectedTopics).map((topics) => [topics]),
    );
  });
});
