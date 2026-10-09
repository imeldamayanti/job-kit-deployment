// Chrome words a full quota in a few ways ("QUOTA_BYTES", "Resource::kQuotaBytes"), all containing "quota".
export function isQuotaError(error: unknown): boolean {
  return error instanceof Error && /quota/i.test(error.message)
}
