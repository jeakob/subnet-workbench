# Subnet Workbench

A fast, no-nonsense IP toolkit that runs entirely in your browser. Eight network-engineering utilities under one roof — visual subnet planning, IPv6, mask/CIDR conversion, ACL wildcards, range summarization, VLSM, and overlap checks.

Everything runs client-side. No tracking, no backend, no install.

> Live: open `Subnet Calculator.html` locally or deploy to GitHub Pages (instructions below).
>
> URL: https://jeakob.github.io/subnet-workbench/

## Tools

- **Visual Subnet Calculator** — IPv4 split/join with notes, color-coding, shareable URL state. Accepts `10.0.0.0/8` shorthand or dotted-mask input. **Multi-network workspace** lets you plan unrelated address blocks side-by-side, and the **Separate** action carves any subnet out of its parent plan into its own top-level network (the original allocation stays visible, dimmed, so the parent plan still reflects what's been carved out).
- **IPv6 Subnet Calculator** — prefix splitting, hex breakdown, EUI-64 helper
- **CIDR ↔ Mask** — instant two-way conversion + binary view
- **Wildcard / ACL Builder** — Cisco inverse mask + ready-to-paste ACL lines
- **IP-in-Subnet Checker** — does this address belong here?
- **Subnet Compare** — overlap, containment, adjacency
- **Range → CIDR** — smallest CIDR aggregation of an arbitrary IP range
- **VLSM Planner** — input host requirements, get an optimal allocation table
- **Summarise** — paste a list of prefixes (CIDR, IP+mask, ranges, IPv6) and get:
  - the **single supernet** (smallest covering CIDR), with exact-vs-over-coverage flag and waste count
  - an **optimal aggregation** — the minimal disjoint CIDR set that covers exactly the union (merges adjacent and overlapping inputs)
  - **overlap detection** and common-leading-bits analysis
  - **Cisco IOS snippets** — summary route, aggregated static routes, and `ip prefix-list` output
  - IPv6 support with the equivalent `ipv6 route` snippet

## Features

- 100% client-side — your inputs never leave the browser
- Dark and light themes, with an adjustable accent color via the Tweaks panel
- Shareable URL state for visual subnet layouts (bookmark or send a link)
- Keyboard-friendly inputs; CIDR shorthand and subnet-mask entry both supported
- No build step — plain HTML, CSS, and JSX-via-Babel

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main` (or run the workflow manually). The included `.github/workflows/deploy.yml` builds and deploys automatically.

The workflow aliases `Subnet Calculator.html` to `index.html` so the app loads at the site root.

## Local dev

Just open `Subnet Calculator.html` in a browser. Everything is static — no server, no dependencies to install.

## License

MIT
