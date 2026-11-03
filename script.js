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
