import { gql } from "graphql-tag";
import { gymTypeDefs } from "../modules/gym/gym.schema";
import { exerciselogTypeDefs } from "../modules/exerciselog/exerciselog.schema";
import { exerciseTypeDefs } from "../modules/exercise/exercise.schema";
import { equipmentTypeDefs } from "../modules/equipment/equipment.schema";
import { workoutplanTypeDefs } from "../modules/workoutplan/workoutplan.schema";
import { userTypeDefs } from "../modules/user/user.schema";
import { authTypeDefs } from "../modules/auth/auth.schema";
import { embeddingTypeDefs } from "../modules/cv/embedding.schema";
import { queueTypeDefs } from "../modules/cv/queue.schema";
import { taxonomyTypeDefs } from "../modules/cv/taxonomy.schema";
import { mediaTypeDefs } from "../modules/media/media.schema";
import { imagesTypeDefs } from "../modules/images/images.schema";

const baseTypeDefs = `
  scalar JSON       # ✅ Add this line
  scalar DateTime
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
  ${workoutplanTypeDefs}
  ${userTypeDefs}
  ${authTypeDefs}
  ${embeddingTypeDefs}
  ${queueTypeDefs}
  ${taxonomyTypeDefs}
  ${mediaTypeDefs}
  ${imagesTypeDefs}

  extend type Query {
    hello: String
  }
`;

export default typeDefs;