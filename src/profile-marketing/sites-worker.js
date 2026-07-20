const INDEX_PATH = "/index.html";

export async function handleSitesRequest(request, environment) {
  if (!environment?.ASSETS?.fetch) {
    return new Response("Static asset binding unavailable", { status: 503 });
  }

  const response = await environment.ASSETS.fetch(request);
  if (response.status !== 404 || !["GET", "HEAD"].includes(request.method)) {
    return response;
  }

  const fallbackUrl = new URL(INDEX_PATH, request.url);
  return environment.ASSETS.fetch(new Request(fallbackUrl, request));
}

export default {
  fetch: handleSitesRequest
};
