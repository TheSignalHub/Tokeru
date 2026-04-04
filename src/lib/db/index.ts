import * as contracts from "./contracts";
import * as users from "./users";
import * as disputes from "./disputes";
import * as escrows from "./escrows";
import * as documents from "./documents";
import * as holdings from "./holdings";
import * as notifications from "./notifications";

export { ensureInit } from "./init";

export const db = {
  contracts,
  users,
  disputes,
  escrows,
  documents,
  holdings,
  notifications,
};
