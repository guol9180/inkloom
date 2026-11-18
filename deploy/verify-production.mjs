const webUrl = process.env.INKLOOM_WEB_URL ?? "https://inkloom.imhgl.com";
const apiUrl = process.env.INKLOOM_API_URL ?? "https://api.inkloom.imhgl.com";

const webResponse = await fetch(webUrl, {
  headers: { Accept: "text/html" }
});
assert(webResponse.ok, `Web returned HTTP ${webResponse.status}.`);
const webHtml = await webResponse.text();
assert(/<title>墨织 InkLoom/i.test(webHtml), "Web response is not the InkLoom app.");
for (const header of [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options"
]) {
  assert(webResponse.headers.has(header), `Web is missing ${header}.`);
}

const healthResponse = await fetch(`${apiUrl}/api/health`);
assert(healthResponse.ok, `API health returned HTTP ${healthResponse.status}.`);
const health = await healthResponse.json();
assert(health?.ok === true, "API health payload is not healthy.");

const preflight = await fetch(`${apiUrl}/api/auth/me`, {
  method: "OPTIONS",
  headers: {
    Origin: webUrl,
    "Access-Control-Request-Method": "GET"
  }
});
assert(preflight.status === 204, `Preflight returned HTTP ${preflight.status}.`);
assert(
  preflight.headers.get("access-control-allow-origin") === webUrl,
  "API did not allow the production Web origin."
);
assert(
  preflight.headers.get("access-control-allow-credentials") === "true",
  "API preflight does not allow credentials."
);

console.log(
  JSON.stringify(
    {
      web: webResponse.status,
      api: healthResponse.status,
      cors: preflight.status,
      securityHeaders: true
    },
    null,
    2
  )
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
