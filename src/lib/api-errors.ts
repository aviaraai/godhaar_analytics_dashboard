export class UnauthorizedError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "This account is not authorized to use the dashboard.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
