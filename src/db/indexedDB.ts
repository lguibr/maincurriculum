// This file aggregates the modularized database operations
import { initDB } from "./core";
import { profileOps } from "./profiles";
import { entityOps } from "./entities";
import { catalogOps } from "./catalog";

export const dbOps = {
  ...profileOps,
  ...entityOps,
  ...catalogOps,
};

export { initDB };
