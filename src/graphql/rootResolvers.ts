import { PubSub } from "graphql-subscriptions";
import { EquipmentResolvers } from "../modules/equipment/equipment.resolvers";
import { GymResolvers } from "../modules/gym/gym.resolvers";
import { UserResolvers } from "../modules/user/user.resolvers";
import { WorkoutPlanResolvers } from "../modules/workoutplan/workoutplan.resolvers";
import { ExerciseResolvers } from "../modules/exercise/exercise.resolvers";
import { ExerciseLogResolvers } from "../modules/exerciselog/exerciselog.resolvers";
import { AuthResolvers } from "../modules/auth/auth.resolvers";
import { SubscriptionResolvers } from "./subscription.resolvers";
import { GraphQLJSON } from "graphql-type-json";
import { EmbeddingResolvers } from "../modules/cv/embedding.resolvers";
import { QueueResolvers } from "../modules/cv/queue.resolvers";
import { TaxonomyResolvers } from "../modules/cv/taxonomy.resolvers";

export const pubsub = new PubSub();

const resolvers = {
  JSON: GraphQLJSON,
  ...EquipmentResolvers,
  ...GymResolvers,
  ...UserResolvers,
  ...WorkoutPlanResolvers,
  ...ExerciseResolvers,
  ...ExerciseLogResolvers,
  ...AuthResolvers,
  ...SubscriptionResolvers,
  ...EmbeddingResolvers,
  ...QueueResolvers,
  ...TaxonomyResolvers,
  Query: {
    hello: () => "Hello world!",
    ...EquipmentResolvers.Query,
    ...GymResolvers.Query,
    ...UserResolvers.Query,
    ...WorkoutPlanResolvers.Query,
    ...ExerciseResolvers.Query,
    ...ExerciseLogResolvers.Query,
    ...EmbeddingResolvers.Query,
    ...QueueResolvers.Query,
    ...TaxonomyResolvers.Query,
  },
  Mutation: {
    ...EquipmentResolvers.Mutation,
    ...GymResolvers.Mutation,
    ...UserResolvers.Mutation,
    ...WorkoutPlanResolvers.Mutation,
    ...ExerciseResolvers.Mutation,
    ...ExerciseLogResolvers.Mutation,
    ...AuthResolvers.Mutation,
    ...EmbeddingResolvers.Mutation,
    ...QueueResolvers.Mutation,
  },
  Subscription: {
    ...SubscriptionResolvers.Subscription,
  },
};

export default resolvers;
