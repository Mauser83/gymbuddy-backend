import { gql } from "graphql-tag";
import { gymTypeDefs } from "../modules/gym/gym.schema";
import { exerciselogTypeDefs } from "../modules/exerciselog/exerciselog.schema";
import { exerciseTypeDefs } from "../modules/exercise/exercise.schema";
import { equipmentTypeDefs } from "../modules/equipment/equipment.schema";
import { workoutTypeDefs } from "../modules/workout/workout.schema";
import { userTypeDefs } from "../modules/user/user.schema";
import { authTypeDefs } from "../modules/auth/auth.schema";

const baseTypeDefs = `
  type Query
  type Mutation
  type Subscription
`;

const typeDefs = gql`
  ${baseTypeDefs}
  ${gymTypeDefs}
  ${exerciselogTypeDefs}
  ${exerciseTypeDefs}
  ${equipmentTypeDefs}
  ${workoutTypeDefs}
  ${userTypeDefs}
  ${authTypeDefs}

  extend type Query {
    hello: String

  }
`;

export default typeDefs;