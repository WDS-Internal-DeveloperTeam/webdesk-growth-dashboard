# 01 — Pilot Selection

**Chosen pilot:** DDI Inform ERP ↔ middleware + dashboard ↔ BigCommerce (real client).

Why it's a good pilot: it exercises the hardest parts of the system at once — dual integration, continuous cron sync, a new datastore, a dashboard with auth/RBAC, and the client-approved contract/schema gates. If the system survives this, the simpler project-types are easier.

Risk to manage: DDI Inform's API surface is **unverified** until discovery. Do not let the pilot block on building the DDI adapter — build against the adapter interface + a mock until real sandbox credentials and verified endpoints exist.
