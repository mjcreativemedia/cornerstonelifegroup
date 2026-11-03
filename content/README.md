# Publishing a guide

1. Add a guide object to `guides.json`: a unique `slug`, title, description, illustration filename, `updated` date (YYYY-MM-DD), takeaway, sections (`id`, title, HTML body), and primary-source links.
2. Use short paragraphs and useful examples. Explain risks, costs, and requirements alongside benefits. Label hypothetical numbers. Do not imply an educational product is a Cornerstone offering.
3. Run `python3 scripts/build-resources.py` from the project folder. The script writes the homepage resource list, `/resources/`, individual guide pages, related reading, metadata, and sitemap.
4. Review the generated pages at desktop and mobile sizes, check links, and publish through the existing Git-connected Cloudflare Pages project.

Shared layout: `templates/page-head.html`, `templates/header.html`, `templates/footer.html`. Homepage content: `templates/home.html`. The existing inquiry is at `/inquiry/`; its form and API remain independent of resource generation. The current templates contain the static site's existing brand and legal notices.

When updating a guide, update its actual `updated` date in the content file. Do not run a formatter on the partial page-head template; format the generated complete pages instead. Do not label content as professionally reviewed unless a reviewer has actually approved it. All section bodies are trusted, repository-authored HTML, not visitor input. No CMS or new dependencies are required.
