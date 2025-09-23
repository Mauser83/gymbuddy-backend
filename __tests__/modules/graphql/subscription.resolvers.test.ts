const mockAsyncIterable = jest.fn();

jest.mock('../../src/graphql/rootResolvers.js', () => ({
  pubsub: {
    asyncIterableIterator: mockAsyncIterable,
  },
}));

const { SubscriptionResolvers } = require('../../src/graphql/subscription.resolvers.js') as typeof import('../../src/graphql/subscription.resolvers.js');

describe('SubscriptionResolvers', () => {
  beforeEach(() => {
    mockAsyncIterable.mockReset();
    mockAsyncIterable.mockImplementation((topics: string[]) => ({ topics }));
  });

  it('maps subscription fields to their pubsub topics', () => {
    const expectedTopics = {
      userRoleUpdated: ['USER_ROLE_UPDATED'],
      gymApproved: ['GYM_APPROVED'],
      userUpdated: ['USER_UPDATED'],
      gymCreated: ['GYM_CREATED'],
    } as const;

    for (const [field, topics] of Object.entries(expectedTopics)) {
      const resolver = (SubscriptionResolvers.Subscription as Record<string, { subscribe: () => unknown }>)[field];
      expect(typeof resolver.subscribe).toBe('function');

      const iterator = resolver.subscribe();
      expect(iterator).toEqual({ topics });
    }

    expect(mockAsyncIterable).toHaveBeenCalledTimes(Object.keys(expectedTopics).length);
    expect(mockAsyncIterable.mock.calls).toEqual(
      Object.values(expectedTopics).map((topics) => [topics]),
    );
  });
});

export {};