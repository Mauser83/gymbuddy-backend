import { gql } from 'graphql-tag';

import { authTypeDefs } from '../modules/auth/auth.schema';
import { embeddingTypeDefs } from '../modules/cv/embedding.schema';
import { knnTypeDefs } from '../modules/cv/knn.schema';
import { queueTypeDefs } from '../modules/cv/queue.schema';
import { taxonomyTypeDefs } from '../modules/cv/taxonomy.schema';
import { equipmentTypeDefs } from '../modules/equipment/equipment.schema';
import { exerciseTypeDefs } from '../modules/exercise/exercise.schema';
import { exerciselogTypeDefs } from '../modules/exerciselog/exerciselog.schema';
import { gymTypeDefs } from '../modules/gym/gym.schema';
import { imagesTypeDefs } from '../modules/images/images.schema';
import { mediaTypeDefs } from '../modules/media/media.schema';
import { recognitionTypeDefs } from '../modules/recognition/recognition.schema';
import { userTypeDefs } from '../modules/user/user.schema';
import { workerTypeDefs } from '../modules/worker/worker.schema';
import { workoutplanTypeDefs } from '../modules/workoutplan/workoutplan.schema';

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
  ${knnTypeDefs}
  ${mediaTypeDefs}
  ${imagesTypeDefs}
  ${workerTypeDefs}
  ${recognitionTypeDefs}

  extend type Query {
    hello: String
  }
`;

export default typeDefs;
