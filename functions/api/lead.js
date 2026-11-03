const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const LEAD_RECIPIENT = "carlos.tpglife@gmail.com";

const LEAD_REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "dob",
  "state",
  "smoker",
  "preference",
];
const ENRICHMENT_IDENTITY_FIELDS = ["firstName", "lastName", "phone", "dob"];
const ENRICHMENT_FIELDS = [
  "contactPreference",
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

  if (Number(request.headers.get("Content-Length")) > 20000) {
    return jsonResponse({ ok: false, error: "Request too large." }, 413);
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

  const isFunding = payload.product_type === "business_funding";
  if (isFunding) {
    const required = [
      "amount",
      "purpose",
      "timing",
      "businessName",
      "industry",
      "state",
      "timeInBusiness",
      "monthlyRevenue",
      "fullName",
      "email",
      "phone",
      "contactPreference",
    ];
    const invalid = required.some(
      (key) =>
        typeof payload[key] !== "string" ||
        !payload[key].trim() ||
        payload[key].length > 254,
    );
    if (
      invalid ||
      !/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(payload.submitted_at || "") ||
      payload.contactConsent !== true ||
      !["Email", "Phone call"].includes(payload.contactPreference) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
      !/^[+0-9() .-]{10,30}$/.test(payload.phone) ||
      !/^[a-f0-9-]{36}$/.test(payload.requestId || "")
    ) {
      return jsonResponse(
        { ok: false, error: "Please check your business and contact details." },
        400,
      );
    }
  }
  const submissionType =
    payload.submission_type === "enrichment" ? "enrichment" : "lead";
  const requiredFields = isFunding
    ? ["fullName", "email", "phone", "businessName"]
    : submissionType === "enrichment"
      ? ENRICHMENT_IDENTITY_FIELDS
      : LEAD_REQUIRED_FIELDS;
  const missingFields = requiredFields.filter(
    (field) => !hasValue(payload[field]),
  );

  if (missingFields.length > 0) {
    console.error(
      "Lead submission rejected: missing fields:",
      missingFields.join(", "),
    );
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 400);
  }

  if (submissionType === "enrichment" && !hasAnyEnrichmentValue(payload)) {
    console.error("Lead enrichment rejected: no enrichment fields present.");
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 400);
  }

  try {
    if ((isFunding || submissionType === "lead") && !env.TURNSTILE_SECRET_KEY) {
      console.error("Lead submission failed: TURNSTILE_SECRET_KEY is not set.");
      return jsonResponse({ ok: false, error: "Unable to submit lead." }, 500);
    }

    if (!env.RESEND_API_KEY) {
      console.error("Lead submission failed: RESEND_API_KEY is not set.");
      return jsonResponse({ ok: false, error: "Unable to submit lead." }, 500);
    }

    if (isFunding || submissionType === "lead") {
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
        return jsonResponse(
          { ok: false, error: "Unable to submit lead." },
          400,
        );
      }
    }

    const emailResult = await sendLeadEmail(payload, env);

    if (!emailResult.ok) {
      console.error("Lead submission email failed:", emailResult.status);
      return jsonResponse({ ok: false, error: "Unable to submit lead." }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Lead submission failed: unexpected exception:", error);
    return jsonResponse({ ok: false, error: "Unable to submit lead." }, 500);
  }
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
  const text = buildLeadEmailText(payload);
  const digest =
    payload.product_type === "business_funding"
      ? Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(text),
            ),
          ),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("")
      : "";
  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "cornerstonelifegroup-pages-function/1.0",
      ...(payload.product_type === "business_funding"
        ? { "Idempotency-Key": `funding-${payload.requestId}-${digest}` }
        : {}),
    },
    body: JSON.stringify({
      from:
        env.RESEND_FROM_EMAIL ||
        "Cornerstone Life Group <onboarding@resend.dev>",
      to: [LEAD_RECIPIENT],
      subject,
      text,
    }),
  });

  return { ok: response.ok, status: response.status };
}

function buildSubmissionSubject(payload) {
  if (payload.product_type === "business_funding")
    return `Business funding inquiry - ${payload.businessName.replace(/[\r\n]/g, " ")}`;
  const prefix =
    payload.submission_type === "enrichment" ? "Lead Update" : "New Lead";
  return `${prefix} - ${formatLeadType(payload)} - ${formatFullName(payload)}`;
}

function buildLeadEmailText(payload) {
  if (payload.product_type === "business_funding") {
    return [
      "New Cornerstone business funding inquiry",
      "Status: New Inquiry",
      `Inquiry ID: ${payload.requestId}`,
      "",
      ...[
        ["Full name", "fullName"],
        ["Business", "businessName"],
        ["Email", "email"],
        ["Phone", "phone"],
        ["Preferred contact", "contactPreference"],
        ["Funding amount", "amount"],
        ["Purpose", "purpose"],
        ["Timing", "timing"],
        ["Industry", "industry"],
        ["State", "state"],
        ["Time in business", "timeInBusiness"],
        ["Average monthly revenue", "monthlyRevenue"],
        ["Contact request recorded", "contactConsent"],
        ["Consent version", "consentVersion"],
        ["Received at", "submitted_at"],
      ].map(
        ([label, key]) =>
          `${label}: ${String(payload[key] ?? "-").slice(0, 500)}`,
      ),
      "",
      `Campaign: ${formatLandingSource(payload)}`,
      "",
      "Inquiry follow-up only. No marketing text consent or credit authorization collected.",
    ].join("\n");
  }
  const isEnrichment = payload.submission_type === "enrichment";
  const heading = isEnrichment
    ? "Cornerstone Life Group lead update"
    : "New Cornerstone Life Group lead";
  const answerLines = isEnrichment
    ? [
        `- Preferred contact: ${formatValue(payload.contactPreference)}`,
        `- Existing coverage: ${formatValue(payload.existingCoverage)}`,
        `- Goal: ${formatValue(payload.goal)}`,
        `- Protecting: ${formatValue(payload.beneficiaryIntent)}`,
        `- Timeframe: ${formatValue(payload.timeframe)}`,
      ]
    : [
        `- Date of birth: ${formatValue(payload.dob)}`,
        `- State: ${formatValue(payload.state)}`,
        `- Smoker status: ${formatValue(payload.smoker)}`,
        `- Burial or cremation: ${formatValue(payload.preference)}`,
      ];

  return [
    heading,
    "",
    `Lead type: ${formatLeadType(payload)}`,
    `Name: ${formatFullName(payload)}`,
    `Phone: ${formatValue(payload.phone)}`,
    `Email: ${formatValue(payload.email)}`,
    `Timestamp: ${formatValue(payload.submitted_at)}`,
    `Landing page source: ${formatLandingSource(payload)}`,
    "",
    "Answers:",
    ...answerLines,
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

  return parts.length > 0
    ? parts.join(" | ")
    : formatValue(payload.landing_url);
}

function formatFullName(payload) {
  return (
    [payload.firstName, payload.lastName]
      .map(formatValue)
      .filter((value) => value !== "-")
      .join(" ")
      .trim() || "-"
  );
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

function hasAnyEnrichmentValue(payload) {
  return ENRICHMENT_FIELDS.some((field) => hasValue(payload[field]));
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
