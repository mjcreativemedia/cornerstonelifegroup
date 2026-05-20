const pages = Array.from(document.querySelectorAll(".funnel-page"));
const leadForm = document.querySelector("#lead-form");
const preferenceForm = document.querySelector("#preference-form");
const qualifyingForm = document.querySelector("#qualifying-form");
const continueToQuestions = document.querySelector("#continue-to-questions");
const qualifyingSubmitButton = qualifyingForm.querySelector(".primary-button");
const submissionError = document.querySelector("#submission-error");
const finalFollowupCopy = document.querySelector("#final-followup-copy");
const playButton = document.querySelector(".play-button");
const videoModal = document.querySelector("#video-modal");
const introVideo = document.querySelector("#intro-video");
const legalModal = document.querySelector("#legal-modal");
const legalModalTitle = document.querySelector("#legal-modal-title");
const legalModalContent = document.querySelector("#legal-modal-content");
const leadData = {};
const trackingFields = getTrackingFields();

const modalContent = {
  about: {
    title: "About Cornerstone Life Group",
    body: `
      <p>Cornerstone Life Group provides assistance with final expense and life insurance coverage options. Requests submitted through this website are reviewed so that available options may be discussed based on the information provided.</p>
      <p>Carlos Vasquez reviews requests and may contact you by phone or text to discuss coverage options, answer questions, and help determine whether a policy may fit your needs.</p>
      <p>For immediate questions, call or text <strong>312-287-4144</strong>.</p>
      <p class="legal-disclaimer">Coverage options, eligibility, rates, and product availability vary by carrier, underwriting, and state approval. Cornerstone Life Group currently serves Michigan, Texas, Virginia, North Carolina, Florida, and Illinois.</p>
    `,
  },
  privacy: {
    title: "Privacy Notice",
    body: `
      <h3>Information Collected</h3>
      <p>This funnel may collect information you submit, including your name, phone number, date of birth, state, smoker status, burial or cremation preference, coverage goals, beneficiary/protection intent, preferred contact method, and other qualification answers.</p>
      <h3>Use Of Information</h3>
      <p>Information may be used to review coverage options, respond to your request, contact you by phone or text, provide customer support, and improve this funnel and related services.</p>
      <h3>Sharing Of Information</h3>
      <p>Information may be shared only as reasonably needed to provide quotes, coverage options, or related insurance services, including with licensed insurance professionals, carrier partners, agencies, or service providers where applicable.</p>
      <h3>Contact</h3>
      <p>For privacy questions or requests, call or text <strong>312-287-4144</strong>.</p>
      <p class="legal-disclaimer">This notice is intended to summarize how submitted information is used for insurance-related follow-up. It should be reviewed periodically as carrier, vendor, and compliance requirements evolve.</p>
    `,
  },
  terms: {
    title: "Terms & Consent",
    body: `
      <h3>No Obligation</h3>
      <p>Submitting information through this website does not require you to purchase insurance or enroll in any product. Coverage is not guaranteed.</p>
      <h3>Phone And Text Consent</h3>
      <p>By submitting your information, you agree that Cornerstone Life Group and/or Carlos Vasquez may call or text you at the number provided about final expense and life insurance options. Consent is not required to purchase. Message and data rates may apply. Reply STOP to opt out of text messages.</p>
      <h3>Coverage Availability</h3>
      <p>Quotes, eligibility, rates, benefits, and coverage are subject to carrier underwriting, product availability, state availability, and final approval. Any examples or options discussed are not guarantees of coverage.</p>
      <h3>Government Affiliation</h3>
      <p>Cornerstone Life Group is not affiliated with Medicare, Social Security, or any government agency.</p>
      <h3>Licensed Service States</h3>
      <p>Cornerstone Life Group currently serves Michigan, Texas, Virginia, North Carolina, Florida, and Illinois. Product availability may vary by state and carrier.</p>
    `,
  },
};

function showPage(pageNumber) {
  pages.forEach((page) => {
    page.classList.toggle("active", Number(page.dataset.page) === pageNumber);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function collectFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function getTrackingFields() {
  const params = new URLSearchParams(window.location.search);
  const pageDefaults = document.body.dataset;

  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "",
    niche: params.get("niche") || pageDefaults.niche || "",
    product_type: params.get("product_type") || pageDefaults.productType || "",
    landing_url: window.location.href,
    landing_page: window.location.pathname,
    referring_page: document.referrer || "",
  };
}

function isLocalPreview() {
  return ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
}

function encodeFormData(data) {
  return new URLSearchParams(data).toString();
}

function setSubmissionError(message) {
  submissionError.textContent = message;
  submissionError.classList.toggle("visible", Boolean(message));
}

function buildSubmissionSubject() {
  const leadName = [leadData.firstName, leadData.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const leadSource = formatSubjectSegment(
    leadData.niche || trackingFields.niche || "final expense",
  );

  return leadName
    ? `New Lead - ${leadSource} - ${leadName}`
    : `New Lead - ${leadSource}`;
}

function formatSubjectSegment(value) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildLeadPayload() {
  return {
    "form-name": "final-expense-lead",
    "bot-field": "",
    subject: buildSubmissionSubject(),
    ...leadData,
    ...trackingFields,
    submitted_at: new Date().toISOString(),
  };
}

async function submitLeadToNetlify() {
  const payload = buildLeadPayload();

  if (isLocalPreview()) {
    window.__lastLeadPayload = payload;
    document.documentElement.dataset.lastLeadPayload = JSON.stringify(payload);
    console.table(payload);
    return;
  }

  const response = await fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: encodeFormData(payload),
  });

  if (!response.ok) {
    throw new Error("Lead submission failed.");
  }
}

function updateFinalFollowupCopy() {
  const preference = leadData.contactPreference;

  if (preference === "call") {
    finalFollowupCopy.textContent =
      "I will be calling you shortly to go over your coverage options.";
    return;
  }

  if (preference === "text") {
    finalFollowupCopy.textContent =
      "I will be texting you shortly to go over your coverage options.";
    return;
  }

  finalFollowupCopy.textContent =
    "I will be calling or texting you shortly to go over your coverage options.";
}

function openModal(modalName) {
  const content = modalContent[modalName];

  if (!content) {
    return;
  }

  legalModalTitle.textContent = content.title;
  legalModalContent.innerHTML = content.body;
  legalModal.classList.add("open");
  legalModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal() {
  legalModal.classList.remove("open");
  legalModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function openVideoModal() {
  introVideo.src = introVideo.dataset.src;
  videoModal.classList.add("open");
  videoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeVideoModal() {
  videoModal.classList.remove("open");
  videoModal.setAttribute("aria-hidden", "true");
  introVideo.src = "";
  document.body.classList.remove("modal-open");
}

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  Object.assign(leadData, collectFormData(leadForm));
  showPage(2);
});

continueToQuestions.addEventListener("click", () => {
  if (!preferenceForm.reportValidity()) {
    return;
  }

  Object.assign(leadData, collectFormData(preferenceForm));
  showPage(3);
});

qualifyingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  Object.assign(leadData, collectFormData(qualifyingForm));
  setSubmissionError("");
  qualifyingSubmitButton.disabled = true;
  qualifyingSubmitButton.textContent = "Submitting...";

  submitLeadToNetlify()
    .then(() => {
      updateFinalFollowupCopy();
      showPage(4);
    })
    .catch(() => {
      setSubmissionError(
        "We could not submit your request just now. Please try again or call/text 312-287-4144.",
      );
    })
    .finally(() => {
      qualifyingSubmitButton.disabled = false;
      qualifyingSubmitButton.textContent = "Continue";
    });
});

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => {
    showPage(Number(button.dataset.next));
  });
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => {
    showPage(Number(button.dataset.back));
  });
});

playButton.addEventListener("click", openVideoModal);

document.querySelectorAll("[data-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    openModal(button.dataset.modal);
  });
});

document.querySelectorAll("[data-close-modal]").forEach((element) => {
  element.addEventListener("click", closeModal);
});

document.querySelectorAll("[data-close-video-modal]").forEach((element) => {
  element.addEventListener("click", closeVideoModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && legalModal.classList.contains("open")) {
    closeModal();
  }

  if (event.key === "Escape" && videoModal.classList.contains("open")) {
    closeVideoModal();
  }
});
