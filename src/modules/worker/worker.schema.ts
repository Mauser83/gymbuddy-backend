export const workerTypeDefs = `
  extend type Mutation {
    runImageWorkerOnce(max: Int = 100): WorkerKickoffPayload!
  }

  type WorkerKickoffPayload {
    ok: Boolean!
    status: String!
  }
`;
