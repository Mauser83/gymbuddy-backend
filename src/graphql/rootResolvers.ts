import { PubSub } from "graphql-subscriptions";
import { EquipmentResolvers } from "../modules/equipment/equipment.resolvers";
import { GymResolvers } from "../modules/gym/gym.resolvers";
import { UserResolvers } from "../modules/user/user.resolvers";
import { WorkoutResolvers } from "../modules/workout/workout.resolvers";
import { ExerciseResolvers } from "../modules/exercise/exercise.resolvers";
import { ExerciseLogResolvers } from "../modules/exerciselog/exerciselog.resolvers";
import { AuthResolvers } from "../modules/auth/auth.resolvers";
import { SubscriptionResolvers } from "./subscription.resolvers";

export const pubsub = new PubSub();

const resolvers = {
  ...EquipmentResolvers,
  ...GymResolvers,
  ...UserResolvers,
  ...WorkoutResolvers,
  ...ExerciseResolvers,
  ...ExerciseLogResolvers,
  ...AuthResolvers,
  ...SubscriptionResolvers,
  Query: {
    hello: () => "Hello world!",
    ...EquipmentResolvers.Query,
    ...GymResolvers.Query,
    ...UserResolvers.Query,
    ...WorkoutResolvers.Query,
    ...ExerciseResolvers.Query,
    ...ExerciseLogResolvers.Query,
  },
  Mutation: {
    ...EquipmentResolvers.Mutation,
    ...GymResolvers.Mutation,
    ...UserResolvers.Mutation,
    ...WorkoutResolvers.Mutation,
    ...ExerciseResolvers.Mutation,
    ...ExerciseLogResolvers.Mutation,
    ...AuthResolvers.Mutation,
  },
  Subscription: {
    ...SubscriptionResolvers.Subscription
  }
};

export default resolvers;
