export function checkSameOrigin(request: Request, env: NodeJS.ProcessEnv): boolean {
  try {
    const origin = request.headers.get("origin");
    if (origin === null) return request.headers.get("sec-fetch-site") === "same-origin";
    const originUrl = new URL(origin);
    if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.username || originUrl.password || originUrl.origin !== origin) return false;
    let host = request.headers.get("host");
    let protocol = new URL(request.url).protocol;
    // Enabling this flag asserts that a trusted proxy overwrites these headers.
    if (env.SPEAKING_STT_TRUST_FORWARDED_HEADERS === "true") {
      host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ?? host;
      const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
      if (forwardedProtocol === "http" || forwardedProtocol === "https") protocol = `${forwardedProtocol}:`;
    }
    if (!host || !/^(?:[A-Za-z0-9.-]+|\[[A-Fa-f0-9:.]+\])(?::[0-9]{1,5})?$/.test(host)) return false;
    if (protocol !== "http:" && protocol !== "https:") return false;
    const expected = new URL(`${protocol}//${host}`);
    return originUrl.protocol === expected.protocol && originUrl.host === expected.host;
  } catch { return false; }
}
