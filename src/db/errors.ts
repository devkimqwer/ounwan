export class CurrentUserMembershipNotFoundError extends Error {
  constructor() {
    super("Current user membership not found.");
    this.name = "CurrentUserMembershipNotFoundError";
  }
}