import resolvers from '../../src/graphql/rootResolvers';
import { executeOperation } from '../testUtils';

describe('rootResolvers', () => {
  test('hello query returns greeting', async () => {
    const res = await executeOperation({ query: 'query { hello }' });
    expect(res.body.singleResult.data?.hello).toBe('Hello world!');
  });

  test('subscription resolvers exist', () => {
    expect(resolvers.Subscription.gymCreated).toBeDefined();
    expect(typeof resolvers.Subscription.gymCreated.subscribe).toBe('function');
  });

  test('merges module resolvers', () => {
    expect(resolvers.Query).toHaveProperty('hello');
    expect(resolvers.Mutation).toBeDefined();
  });
});
