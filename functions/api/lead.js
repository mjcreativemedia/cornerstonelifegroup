const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const LEAD_RECIPIENT = "carlos.tpglife@gmail.com";

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
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    console.error("Lead submission rejected: invalid JSON payload.");
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 400);
  }

  if (hasValue(payload.companyWebsite)) {
    console.error("Lead submission rejected: honeypot filled.");
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 400);
  }

  const missingFields = REQUIRED_FIELDS.filter((field) => !hasValue(payload[field]));

  if (missingFields.length > 0) {
    console.error(
      "Lead submission rejected: missing fields:",
      missingFields.join(", "),
    );
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 400);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    console.error("Lead submission failed: TURNSTILE_SECRET_KEY is not set.");
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 500);
  }

  if (!env.RESEND_API_KEY) {
    console.error("Lead submission failed: RESEND_API_KEY is not set.");
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 500);
  }

  const turnstileResult = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    payload["cf-turnstile-response"],
    request.headers.get("CF-Connecting-IP") || "",
  );

  if (!turnstileResult.success) {
    console.error(
      "Lead submission rejected: Turnstile failed:",
      (turnstileResult["error-codes"] || []).join(", ") || "unknown",
    );
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 400);
  }

  const emailResult = await sendLeadEmail(payload, env);

  if (!emailResult.ok) {
    console.error("Lead submission email failed:", emailResult.status);
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 500);
  }

  return jsonResponse({ ok: true });
}

async function verifyTurnstile(secret, token, remoteip) {
  if (!hasValue(token)) {
    return { success: false, "error-codes": ["missing-input-response"] };
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: String(token),
        remoteip,
      }),
    });

    if (!response.ok) {
      return { success: false, "error-codes": [`http-${response.status}`] };
    }

    return response.json();
  } catch (error) {
    console.error("Turnstile validation request failed:", error.message);
    return { success: false, "error-codes": ["request-failed"] };
  }
}

async function sendLeadEmail(payload, env) {
  const subject = buildSubmissionSubject(payload);
  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "cornerstonelifegroup-pages-function/1.0",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || "Cornerstone Life Group <onboarding@resend.dev>",
      to: [LEAD_RECIPIENT],
      subject,
      text: buildLeadEmailText(payload),
    }),
  });

  return { ok: response.ok, status: response.status };
}

function buildSubmissionSubject(payload) {
  return `New Lead - ${formatLeadType(payload)} - ${formatFullName(payload)}`;
}

function buildLeadEmailText(payload) {
  return [
    "New Cornerstone Life Group lead",
    "",
    `Lead type: ${formatLeadType(payload)}`,
    `Name: ${formatFullName(payload)}`,
    `Phone: ${formatValue(payload.phone)}`,
    `Email: ${formatValue(payload.email)}`,
    `Timestamp: ${formatValue(payload.submitted_at)}`,
    `Landing page source: ${formatLandingSource(payload)}`,
    "",
    "Answers:",
    `- Date of birth: ${formatValue(payload.dob)}`,
    `- State: ${formatValue(payload.state)}`,
    `- Smoker status: ${formatValue(payload.smoker)}`,
    `- Burial or cremation: ${formatValue(payload.preference)}`,
    `- Preferred contact: ${formatValue(payload.contactPreference)}`,
    `- Age range: ${formatValue(payload.ageRange)}`,
    `- Existing coverage: ${formatValue(payload.existingCoverage)}`,
    `- Goal: ${formatValue(payload.goal)}`,
    `- Protecting: ${formatValue(payload.beneficiaryIntent)}`,
    `- Timeframe: ${formatValue(payload.timeframe)}`,
  ].join("\n");
}

function formatLeadType(payload) {
  return formatTitle(payload.product_type || payload.niche || "life insurance");
}

function formatLandingSource(payload) {
  const parts = [
    payload.landing_page,
    payload.utm_source && `utm_source=${payload.utm_source}`,
    payload.utm_medium && `utm_medium=${payload.utm_medium}`,
    payload.utm_campaign && `utm_campaign=${payload.utm_campaign}`,
    payload.utm_content && `utm_content=${payload.utm_content}`,
    payload.utm_term && `utm_term=${payload.utm_term}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : formatValue(payload.landing_url);
}

function formatFullName(payload) {
  return [payload.firstName, payload.lastName]
    .map(formatValue)
    .filter((value) => value !== "-")
    .join(" ")
    .trim() || "-";
}

function formatTitle(value) {
  return formatValue(value)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value) {
  const normalized = String(value || "").trim();
  return normalized || "-";
}

function hasValue(value) {
  return formatValue(value) !== "-";
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
