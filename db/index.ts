import { createPostgresD1Adapter } from "./postgres-adapter";

export function getDb() {
  return createPostgresD1Adapter();
}
