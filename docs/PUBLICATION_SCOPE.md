# Publication Scope

This repository is a private publication copy prepared from a validated local delivery package.

Included:

- Full source code for the Node.js backend, browser admin console, public activity entry page, and WeChat Mini Program
- Deployment and utility scripts
- Automated tests
- Operational documentation
- Demo seed data in `data/seed.json`

Excluded:

- Runtime database files such as `data/db.json`
- Dependency caches such as `node_modules`
- Temporary release folders and build caches
- Local `.env` files and server-only secrets
- Payment certificates, private keys, and message tokens
- Live domains, live AppSecret values, and real operating data

Generalized before publication:

- Default WeChat AppID values
- Example production domain values
- Deployment examples that previously referenced a live environment

Validation target for this publication copy:

- Node syntax check
- Node test suite
- Boundary scan for secrets and runtime artifacts
