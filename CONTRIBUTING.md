# Contributing to Aegis

Thanks for your interest. Aegis is an open-source M365 governance platform; contributions of any size are welcome — bug fixes, new compliance evaluators, additional framework seeds, plugin templates for the marketplace, or full feature work.

## Ground rules

1. **Be respectful.** Disagreements are fine; personal attacks aren't.
2. **One concern per PR.** Easier to review, easier to revert.
3. **No generated AI commentary in commit messages.** Co-author trailers should reflect humans who actually contributed.
4. **Don't commit secrets.** Run `git diff` before pushing. The provided `.gitignore` covers `.env` files; double-check anyway.

## Local development

```bash
git clone https://github.com/<your-fork>/aegis.git
cd aegis

npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY at minimum.

npm run dev   # http://localhost:8080
```

For backend / migration / edge function changes you'll need a working Supabase project (cloud free tier is fine):

```bash
supabase login
supabase link --project-ref <your-project-ref>

# After making changes:
.\scripts\deploy-aegis.ps1     # or ./scripts/deploy-aegis.sh on macOS/Linux
```

## Project layout

```
src/
  components/         React components, organized by feature area
    ai/               AI-driven views (chat, anomaly detection, etc.)
    portal/           Customer-facing portal components
    customers/        MSP-side customer management UI
    views/            Top-level page components keyed by tab id
  contexts/           React contexts (TenantContext, BrandingContext, PortalHostContext)
  hooks/              Custom hooks
  lib/                Shared utilities, database wrappers, type-safe Graph helpers
  pages/              Route-level components
  types/              Shared TypeScript types

supabase/
  migrations/         Postgres migrations (timestamp-prefixed)
  functions/          Edge functions (Deno)
  config.toml         Project-level config — every function listed with verify_jwt
```

## Coding conventions

- **TypeScript strict.** No `any` without a comment explaining why.
- **Functional React components** with hooks; no class components.
- **Tailwind for styling**, shadcn/ui primitives for UI building blocks.
- **No inline secrets** — always go through env vars or Supabase secrets.
- **RLS-first.** Every new table gets RLS enabled and explicit policies for MSP user + portal user (where applicable). See existing migrations for patterns.
- **Edge function auth.** Functions that take a user JWT must `getUser()` and verify ownership BEFORE doing any sensitive work. Functions invoked by cron / other functions can use `verify_jwt = false` + the service-role key, but document why.

## Adding a compliance evaluator

1. Pick a key (e.g. `mfa-required-for-admins`). Reuse existing keys when possible — one evaluator can satisfy multiple frameworks.
2. Add the evaluator function to `supabase/functions/collect-compliance-evidence/index.ts`. Returns `{status, notes, snapshot}`.
3. In a new migration, INSERT rows into `compliance_controls` referencing the evaluator key for whichever frameworks it covers.

See `20260429150000_compliance_evidence.sql` and `20260429160000_compliance_soc2_cmmc_seed.sql` for examples.

## Adding a marketplace plugin

1. Author it in the **Plugins** view of a running instance, set `is_public = true`, and publish.
2. To seed it for everyone: write a migration that inserts the plugin row directly. The `plugins` table has its full schema documented inline.

## Submitting changes

1. Fork, branch, commit, push, open a PR against `main`.
2. Run `npm run build` locally; CI will reject failing TypeScript.
3. Reference any related issue in the PR body.
4. For new features, update the README's "Implemented" / "Open ideas" sections.
5. For schema changes, add the manual deploy step to `HANDOFF.md` so users running `git pull` know what they need to do.

## Reporting bugs / requesting features

Open a GitHub issue. Include:

- What you expected to happen
- What actually happened
- Reproduction steps
- Browser + Supabase project version
- Relevant logs (sanitized — no secrets, no real customer data)

## Security issues

**Don't open a public issue for security vulnerabilities.** See [SECURITY.md](./SECURITY.md) for the disclosure process.

## License

By contributing, you agree your contributions will be licensed under the project's [MIT License](./LICENSE).
