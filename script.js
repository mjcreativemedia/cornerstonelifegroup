const form = document.querySelector("#funding-form");
const steps = [...form.querySelectorAll("fieldset")];
const progress = [...document.querySelectorAll(".progress li")];
const next = document.querySelector("#continue");
const back = document.querySelector("#back");
const error = document.querySelector("#form-error");
let current = 0;
let sending = false;
const requestId = crypto.randomUUID();
const submittedAt = new Date().toISOString();
let securityLoaded = false;
const states =
  "Alabama,Alaska,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,District of Columbia,Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Kentucky,Louisiana,Maine,Maryland,Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,West Virginia,Wisconsin,Wyoming";
states
  .split(",")
  .forEach((state) =>
    document.querySelector("#state").add(new Option(state, state)),
  );
function showStep(index) {
  current = index;
  steps.forEach((step, i) => {
    step.hidden = i !== index;
    step.disabled = i !== index;
  });
  progress.forEach((item, i) => {
    item.classList.toggle("current", i === index);
    item.classList.toggle("done", i < index);
    if (i === index) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  back.hidden = index === 0;
  next.querySelector("span").textContent =
    index === 2 ? "Request funding options" : "Continue";
  error.textContent = "";
  if (index === 2 && !securityLoaded) loadSecurity();
}
showStep(0);
back.addEventListener("click", () => {
  if (!sending) {
    showStep(current - 1);
    steps[current].querySelector("input,select").focus({ preventScroll: true });
  }
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (sending) return;
  const invalid = [...steps[current].querySelectorAll("input,select")].find(
    (input) => !input.checkValidity(),
  );
  if (invalid) {
    invalid.reportValidity();
    return;
  }
  if (current < 2) {
    showStep(current + 1);
    steps[current].querySelector("input,select").focus({ preventScroll: true });
    return;
  }
  error.textContent = "";
  const token = document.querySelector('[name="cf-turnstile-response"]')?.value;
  if (!token) {
    error.textContent =
      "Please complete the security check. If it does not load, call Carlos at (312) 287-4144.";
    return;
  }
  sending = true;
  next.disabled = true;
  back.disabled = true;
  next.querySelector("span").textContent = "Sending your inquiry…";
  // Disabled steps remain excluded from validation; collect their values explicitly.
  const payload = Object.fromEntries(
    [...form.querySelectorAll("input,select")].map((input) => [
      input.name,
      input.type === "checkbox" ? input.checked : input.value,
    ]),
  );
  const params = new URLSearchParams(location.search);
  Object.assign(payload, {
    product_type: "business_funding",
    requestId,
    consentVersion: "funding-inquiry-v1",
    submitted_at: submittedAt,
    landing_page: location.pathname,
  });
  [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ].forEach((key) => (payload[key] = (params.get(key) || "").slice(0, 200)));
  try {
    const response = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true)
      throw new Error("Submission failed");
    document.querySelector("#form-content").hidden = true;
    const confirmation = document.querySelector("#confirmation");
    confirmation.hidden = false;
    confirmation.focus({ preventScroll: true });
  } catch {
    error.textContent =
      "Your inquiry could not be confirmed. Your answers are still here. Please try again or call Carlos at (312) 287-4144.";
    if (window.turnstile) window.turnstile.reset();
  } finally {
    sending = false;
    next.disabled = false;
    back.disabled = false;
    next.querySelector("span").textContent = "Request funding options";
  }
});
// The existing production Turnstile key is domain restricted. Local previews never simulate receipt.
function loadSecurity() {
  securityLoaded = true;
  if (["127.0.0.1", "localhost"].includes(location.hostname)) {
    document.querySelector("#turnstile").innerHTML =
      '<p class="field-note">Local preview: live security verification and delivery must be tested on the configured domain.</p>';
    return;
  }
  const securityScript = document.createElement("script");
  securityScript.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=initSecurity&render=explicit";
  securityScript.async = true;
  window.initSecurity = () =>
    window.turnstile.render("#turnstile", {
      sitekey: "0x4AAAAAADTYEea7q_84zoHV",
      theme: "light",
      "error-callback": () => {
        error.textContent =
          "Security verification is unavailable. Please retry or call (312) 287-4144.";
      },
    });
  document.head.append(securityScript);
}
document.querySelectorAll("[data-purpose]").forEach((link) =>
  link.addEventListener("click", () => {
    if (sending || !document.querySelector("#confirmation").hidden) return;
    document.querySelector("#purpose").value = link.dataset.purpose;
    showStep(0);
  }),
);
const legal = {
  privacy: {
    title: "Privacy Notice",
    body: `<h3>Information you provide</h3><p>The inquiry form asks for your funding needs, business name, industry, state, time in business, monthly revenue range, name, email, phone, and preferred contact method. We also receive campaign source information when present and record the inquiry time and your contact request. Do not submit bank statements, account numbers, Social Security numbers, or identification through this form.</p><h3>How this inquiry is handled</h3><p>Your inquiry is sent to Cornerstone Life Group so Carlos Vasquez can review it and respond using your selected contact method. Cloudflare provides website and security services; Resend provides email delivery. Those services process data needed to deliver and protect the inquiry.</p><h3>Provider applications</h3><p>If you choose to explore a provider option, discuss with Carlos what information will be shared and how the provider’s application process works. A provider may have its own privacy notice and authorization requirements. This form does not authorize a credit check.</p><h3>Your choices</h3><p>This form requests follow-up about your inquiry; it does not enroll you in optional marketing texts. To ask about access, correction, or deletion of your submitted information, or to change your contact preference, call <a href="tel:+13122874144">(312) 287-4144</a>.</p>`,
  },
  terms: {
    title: "Funding disclosures",
    body: `<h3>Our role</h3><p>Cornerstone Life Group is a business funding broker and referral partner, not a direct lender. We help business owners explore potential options through funding providers. Providers determine eligibility, approval, available products, and terms.</p><h3>An inquiry is a starting point</h3><p>Submitting this form is not a credit application, a credit check authorization, an approval, or a commitment to fund. An inquiry creates no obligation to accept a funding offer. Products and service availability vary by provider, location, and business circumstances.</p><h3>Review the complete terms</h3><p>No funding amount, timing, cost, or approval outcome is guaranteed. Before proceeding, review the provider’s written terms, including total costs, fees, repayment schedule, collateral, and any personal guarantee. Ask Carlos about any broker or referral compensation and any fee that may apply to you.</p><h3>Contact</h3><p>Questions about this website or your inquiry? Call Carlos Vasquez at <a href="tel:+13122874144">(312) 287-4144</a>.</p>`,
  },
};
const dialog = document.querySelector("#legal-dialog");
document.querySelectorAll("[data-legal]").forEach((button) =>
  button.addEventListener("click", () => {
    const content = legal[button.dataset.legal];
    document.querySelector("#legal-title").textContent = content.title;
    document.querySelector("#legal-body").innerHTML = content.body;
    dialog.showModal();
  }),
);
document
  .querySelector(".dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  }
});
document.querySelector("#year").textContent = new Date().getFullYear();
const mobileCTA = document.querySelector(".mobile-cta");
new IntersectionObserver(
  (entries) => {
    mobileCTA.classList.toggle("is-hidden", entries[0].isIntersecting);
  },
  { threshold: 0 },
).observe(document.querySelector("#inquiry"));
