const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "dob",
  "state",
  "smoker",
  "preference",
  "contactPreference",
  "ageRange",
  "existingCoverage",
  "goal",
  "beneficiaryIntent",
  "timeframe",
];

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405, {
      Allow: "POST",
    });
  }

  let payload;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Lead submission parse failed:", error.message);
    return jsonResponse({ ok: false, error: "Invalid request." }, 400);
  }

  if (!payload || typeof payload !== "object") {
    console.error("Lead submission rejected: missing JSON object.");
    return jsonResponse({ ok: false, error: "Invalid request." }, 400);
  }

  if (String(payload.companyWebsite || "").trim()) {
    console.error("Lead submission rejected: honeypot filled.");
    return jsonResponse({ ok: false, error: "Invalid request." }, 400);
  }

  const missingFields = REQUIRED_FIELDS.filter((field) => !hasValue(payload[field]));

  if (missingFields.length > 0) {
    console.error(
      "Lead submission rejected: missing fields:",
      missingFields.join(", "),
    );
    return jsonResponse({ ok: false, error: "Missing required fields." }, 400);
  }

  const turnstileToken = String(payload["cf-turnstile-response"] || "").trim();

  if (!turnstileToken) {
    console.error("Lead submission rejected: missing Turnstile token.");
    return jsonResponse({ ok: false, error: "Verification failed." }, 400);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    console.error("Lead submission failed: TURNSTILE_SECRET_KEY is not set.");
    return jsonResponse({ ok: false, error: "Service unavailable." }, 503);
  }

  const turnstileResult = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    turnstileToken,
    request.headers.get("CF-Connecting-IP") || "",
  );

  if (!turnstileResult.success) {
    console.error(
      "Lead submission rejected: Turnstile failed:",
      (turnstileResult["error-codes"] || []).join(", ") || "unknown",
    );
    return jsonResponse({ ok: false, error: "Verification failed." }, 400);
  }

  if (!env.LEAD_EMAIL || !env.LEAD_EMAIL_TO) {
    console.error("Lead submission failed: email binding or recipient missing.");
    return jsonResponse({ ok: false, error: "Service unavailable." }, 503);
  }

  const subject = buildSubmissionSubject(payload);

  try {
    await env.LEAD_EMAIL.send({
      to: env.LEAD_EMAIL_TO,
      from: env.LEAD_EMAIL_FROM || "leads@mycornerstoneplan.com",
      subject,
      text: buildLeadEmailText(payload, subject),
    });
  } catch (error) {
    console.error(
      "Lead submission email failed:",
      error.code || "unknown",
      error.message,
    );
    return jsonResponse({ ok: false, error: "Service unavailable." }, 503);
  }

  return jsonResponse({ ok: true });
}

async function verifyTurnstile(secret, token, remoteip) {
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip,
      }),
    });

    if (!response.ok) {
      return { success: false, "error-codes": [`http-${response.status}`] };
    }

    return response.json();
  } catch (error) {
    console.error("Turnstile validation request failed:", error.message);
    return { success: false, "error-codes": ["internal-error"] };
  }
}

function buildSubmissionSubject(payload) {
  const leadName = [payload.firstName, payload.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const leadSource = formatSubjectSegment(payload.niche || "final expense");

  return leadName
    ? `New Lead - ${leadSource} - ${leadName}`
    : `New Lead - ${leadSource}`;
}

function formatSubjectSegment(value) {
  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildLeadEmailText(payload, subject) {
  const rows = [
    ["Subject", subject],
    ["First name", payload.firstName],
    ["Last name", payload.lastName],
    ["Phone", payload.phone],
    ["Date of birth", payload.dob],
    ["State", payload.state],
    ["Smoker status", payload.smoker],
    ["Burial or cremation", payload.preference],
    ["Contact preference", payload.contactPreference],
    ["Age range", payload.ageRange],
    ["Existing coverage", payload.existingCoverage],
    ["Goal", payload.goal],
    ["Coverage protects", payload.beneficiaryIntent],
    ["Timeframe", payload.timeframe],
    ["Niche", payload.niche],
    ["Product type", payload.product_type],
    ["Landing URL", payload.landing_url],
    ["Landing page", payload.landing_page],
    ["Referring page", payload.referring_page],
    ["UTM source", payload.utm_source],
    ["UTM medium", payload.utm_medium],
    ["UTM campaign", payload.utm_campaign],
    ["UTM content", payload.utm_content],
    ["UTM term", payload.utm_term],
    ["Submitted at", payload.submitted_at],
  ];

  return rows
    .map(([label, value]) => `${label}: ${formatEmailValue(value)}`)
    .join("\n");
}

function formatEmailValue(value) {
  const normalized = String(value || "").trim();
  return normalized || "-";
}

function hasValue(value) {
  return String(value || "").trim().length > 0;
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
