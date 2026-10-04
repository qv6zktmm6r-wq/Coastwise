export const redactSensitivePath = (url: string) => url.replace(
  /\/families\/invites\/[^/]+(?=\/accept(?:$|\/)|$)/,
  "/families/invites/[REDACTED]",
);
