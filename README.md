# Subnet Workbench

A modern, browser-only network engineering toolkit. Inspired by davidc.net's classic Visual Subnet Calculator, modernized with IPv6, ACL/wildcard tooling, range→CIDR summarization, VLSM planning, and overlap checks.

Everything runs client-side. No tracking, no backend.

## Tools

- **Visual Subnet Calculator** — IPv4 split/join with notes & color-coding
- **IPv6 Subnet Calculator** — prefix splitting, hex breakdown, EUI-64 helper
- **CIDR ↔ Mask** — instant two-way conversion + binary view
- **Wildcard / ACL Builder** — Cisco inverse mask + ready-to-paste ACL lines
- **IP-in-Subnet Checker** — does this address belong here?
- **Subnet Compare** — overlap, containment, adjacency
- **Range → CIDR** — smallest CIDR aggregation of an arbitrary IP range
- **VLSM Planner** — input host requirements, get an optimal allocation table

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main` (or run the workflow manually). The included `.github/workflows/deploy.yml` builds and deploys automatically.

The workflow aliases `Subnet Calculator.html` to `index.html` so the app loads at the site root.

## Local dev

Just open `Subnet Calculator.html` in a browser. Everything is static.
