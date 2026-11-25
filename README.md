# Aryan Kothari - portfolio (static site, no build step)

## Run locally
    cd site-kit && python3 -m http.server 8000
    open http://localhost:8000
(Open through a local server, not by double-clicking: the 3D module needs http.)

## Edit
- Hero animation: assets/market.js (scattered data -> sorted bars -> decision; no external files)
- Your email, LinkedIn, phone, CV file: assets/config.js
- Text and sections: index.html (each section is commented)
- Sample ESG card: search "EDIT" in index.html
- Colours and type: top of assets/site.css

## Deploy to GitHub Pages
Upload index.html, the assets/ folder, deal-sourcing-agent.html and medibridge.html to the repo root,
plus your CV and model files with the names used in index.html (Aryan_Kothari_CV.pdf, biofresh_model.xlsx,
biofresh_report.pdf, ferragamo_report.pdf, ferragamo_model.xlsx) - or edit the links to your names.

## Live agents
worker.js is a Cloudflare Worker (not uploaded to GitHub). Follow its header, then paste the Worker URL
into `const API_URL=""` in both agent pages.
