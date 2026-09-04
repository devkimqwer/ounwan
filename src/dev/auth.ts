export function isDevAuthEnabled() {
  return process.env.NODE_ENV === "development";
}

export function assertDevAuthEnabled() {
  if (!isDevAuthEnabled()) {
    throw new Error("Development auth is disabled.");
  }
}