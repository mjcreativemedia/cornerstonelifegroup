export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405, {
      Allow: "POST",
    });
  }

  try {
    await request.json();
  } catch (error) {
    console.error("Lead submission parse failed:", error.message);
    return jsonResponse({ ok: false, error: "Invalid request." }, 400);
  }

  return jsonResponse({ ok: true, status: "stubbed" });
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
