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
  Query: {
    hello: () => "Hello world!",
    ...EquipmentResolvers.Query,
    ...GymResolvers.Query,
    ...UserResolvers.Query,
    ...WorkoutPlanResolvers.Query,
    ...ExerciseResolvers.Query,
    ...ExerciseLogResolvers.Query,
  },
  Mutation: {
    ...EquipmentResolvers.Mutation,
    ...GymResolvers.Mutation,
    ...UserResolvers.Mutation,
    ...WorkoutPlanResolvers.Mutation,
    ...ExerciseResolvers.Mutation,
    ...ExerciseLogResolvers.Mutation,
    ...AuthResolvers.Mutation,
  },
  Subscription: {
    ...SubscriptionResolvers.Subscription,
  },
};

export default resolvers;
