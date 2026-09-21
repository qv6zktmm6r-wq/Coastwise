export function headersForProductionRequest(
  requestUrl: string,
  productionOrigin: string,
  externalAccessToken: string | undefined,
  existingHeaders: Record<string, string> = {},
): Record<string, string> {
  if (!externalAccessToken || new URL(requestUrl).origin !== productionOrigin) {
    return existingHeaders;
  }

  return {
    ...existingHeaders,
    Authorization: `Bearer ${externalAccessToken}`,
  };
}