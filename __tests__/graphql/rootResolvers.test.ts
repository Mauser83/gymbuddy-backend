import { Kind } from 'graphql';

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

  test('DateTime scalar serializes strings and Date instances', () => {
    const asDate = new Date('2023-05-10T13:45:00.000Z');
    expect(resolvers.DateTime.serialize(asDate)).toBe('2023-05-10T13:45:00.000Z');

    const asString = '2023-12-01T00:00:00.000Z';
    expect(resolvers.DateTime.serialize(asString)).toBe(asString);
  });

  test('DateTime scalar parses runtime and literal values', () => {
    const isoString = '2024-01-02T03:04:05.000Z';
    expect(resolvers.DateTime.parseValue(isoString)).toEqual(new Date(isoString));
    expect(resolvers.DateTime.parseValue(null)).toBeNull();

    expect(
      resolvers.DateTime.parseLiteral({ kind: Kind.STRING, value: isoString } as any),
    ).toEqual(new Date(isoString));
    expect(resolvers.DateTime.parseLiteral({ kind: Kind.INT, value: '1' } as any)).toBeNull();
  });
});