# Publishing educational content

- `guides.json`: foundational guides at `/resources/<slug>/`.
- `topics.json`: educational funding topics at `/funding/<slug>/`, grouped by `category`.
- `categories.json`: navigation and the four illustrated homepage entry points.

Each article has a unique slug, title, description, illustration filename, takeaway, sections (IDs, titles, repository-authored HTML), primary-source links, and actual `updated` date. Funding topics cover definition, mechanics, suitability, qualification factors, costs/repayment/risks, and questions. `related` may list other article slugs.

Run `python3 scripts/build-resources.py` to generate the homepage, resource hub, funding hub/category pages, articles, related reading, metadata, and sitemap. Format generated complete pages if needed; do not run an HTML formatter on the partial page-head template.

Shared chrome lives in `templates/header.html` and `templates/footer.html`; homepage content lives in `templates/home.html`. The optional three-step inquiry lives independently at `/inquiry/`. Keep the full legal name, Cornerstone Life Group LLC, in identity and disclosures; Business Funding Solutions is the descriptor.

Educational coverage is not program availability. Do not add provider logos, relationship claims, eligibility cutoffs, pricing, guarantees, or credentials without confirmation. SLOC has been confirmed by the site owner to mean secured line of credit; it does not mean a securities-backed investment-account line here.

Client examples require verified supporting facts and explicit consent before publication. Draft case studies and sensitive source material belong outside this repository: Cloudflare publishes this root directory. No case-study draft or credit report should be placed under a public, hidden, or unlinked site path. There are currently no approved published client examples.
