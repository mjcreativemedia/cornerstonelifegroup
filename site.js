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

// Carry only campaign attribution through educational pages; never contact details.
const attribution = new URLSearchParams(location.search);
const campaignKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];
document.querySelectorAll('a[href^="/"]').forEach((link) => {
  const target = new URL(link.href);
  campaignKeys.forEach((key) => {
    if (attribution.has(key))
      target.searchParams.set(key, attribution.get(key).slice(0, 200));
  });
  link.href = target.pathname + target.search + target.hash;
});
