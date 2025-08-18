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
import { GraphQLScalarType, Kind } from "graphql";
import { EmbeddingResolvers } from "../modules/cv/embedding.resolvers";
import { QueueResolvers } from "../modules/cv/queue.resolvers";
import { TaxonomyResolvers } from "../modules/cv/taxonomy.resolvers";
import { KnnResolvers } from "../modules/cv/knn.resolvers";
import { MediaResolvers } from "../modules/media/media.resolvers";
import { ImagesResolvers } from "../modules/images/images.resolvers";
import { WorkerResolvers } from "../modules/worker/worker.resolvers";

export const pubsub = new PubSub();

const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO-8601 date-time scalar",
  serialize(value) {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value as string).toISOString();
  },
  parseValue(value) {
    return value ? new Date(value as string) : null;
  },
  parseLiteral(ast) {
    return ast.kind === Kind.STRING ? new Date(ast.value) : null;
  },
});

const resolvers = {
  JSON: GraphQLJSON,
  DateTime: DateTimeScalar,
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
  ...KnnResolvers,
  ...MediaResolvers,
  ...ImagesResolvers,
  ...WorkerResolvers,
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
    ...KnnResolvers.Query,
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
    ...MediaResolvers.Mutation,
    ...ImagesResolvers.Mutation,
    ...WorkerResolvers.Mutation,
  },
  Subscription: {
    ...SubscriptionResolvers.Subscription,
  },
};

export default resolvers;
