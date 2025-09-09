import { GraphQLError } from "graphql";

export const MAX_IMAGE_BYTES = 10_000_000;

export function assertSizeWithinLimit(contentLength?: number) {
  if (contentLength !== undefined && contentLength > MAX_IMAGE_BYTES) {
    throw new GraphQLError("File too large", {
      extensions: { code: "PAYLOAD_TOO_LARGE" },
    });
  }
}