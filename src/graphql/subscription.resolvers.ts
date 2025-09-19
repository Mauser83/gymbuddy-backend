import { pubsub } from './rootResolvers';

export const SubscriptionResolvers = {
  Subscription: {
    userRoleUpdated: {
      subscribe: () => pubsub.asyncIterableIterator(['USER_ROLE_UPDATED']),
    },
    gymApproved: {
      subscribe: () => pubsub.asyncIterableIterator(['GYM_APPROVED']),
    },
    userUpdated: {
      subscribe: () => pubsub.asyncIterableIterator(['USER_UPDATED']),
    },
    gymCreated: {
      subscribe: () => pubsub.asyncIterableIterator(['GYM_CREATED']),
    },
  },
};
