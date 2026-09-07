export class CurrentUserMembershipNotFoundError extends Error {
  constructor() {
    super("Current user membership not found.");
    this.name = "CurrentUserMembershipNotFoundError";
  }
}
export class ActiveSeasonNotFoundError extends Error {
  constructor() {
    super("Active season not found.");
    this.name = "ActiveSeasonNotFoundError";
  }
}
