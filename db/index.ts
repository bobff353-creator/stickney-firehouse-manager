import { drizzle } from "drizzle-orm/libsql";
import { getLibsqlClient } from "./d1-libsql";
import * as schema from "./schema";

export function getDb() {
  return drizzle(getLibsqlClient(), { schema });
}
