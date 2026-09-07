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

export class PendingSeasonAlreadyExistsError extends Error {
  constructor() {
    super("Pending season already exists.");
    this.name = "PendingSeasonAlreadyExistsError";
  }
}

export class SeasonStartDateInPastError extends Error {
  constructor() {
    super("Season start date must be today or later.");
    this.name = "SeasonStartDateInPastError";
  }
}
export class PendingSeasonNotFoundError extends Error {
  constructor() {
    super("Pending season not found.");
    this.name = "PendingSeasonNotFoundError";
  }
}
