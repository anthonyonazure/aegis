# Releasing Aegis

Aegis follows [Semantic Versioning](https://semver.org/). Cut a release whenever the `[Unreleased]` section of [CHANGELOG.md](./CHANGELOG.md) accumulates enough work to be worth tagging — typically after a meaningful feature, bug fix sweep, or schema migration.

## Versioning policy

- **MAJOR** (`1.0.0` → `2.0.0`): breaking changes to the public surface — incompatible schema migrations that require manual intervention, removed env vars, removed edge functions, or breaking REST/RPC contract changes.
- **MINOR** (`0.1.0` → `0.2.0`): new feature, new edge function, new migration that's backwards-compatible (additive), new env var with a sensible default.
- **PATCH** (`0.1.0` → `0.1.1`): bug fix, doc-only change, dep bump that doesn't move a major boundary.

Pre-1.0 means **anything is fair game between minor versions** — make breaking changes loudly via the CHANGELOG but don't burn a major bump on every schema change while the platform is still settling.

## Release checklist

Run from a clean `main` branch with no uncommitted changes.

1. **Decide the version.** Look at [CHANGELOG.md](./CHANGELOG.md). The `[Unreleased]` section already groups changes under Added/Changed/Fixed/Security — match severity to the bullets.

2. **Bump `package.json`.**
   ```bash
   npm version <patch|minor|major> --no-git-tag-version
   ```
   This rewrites the `version` field. We pass `--no-git-tag-version` because the tag is created at the end after the CHANGELOG is finalized.

3. **Promote `[Unreleased]` to a versioned section in CHANGELOG.md.**
   - Rename `## [Unreleased]` to `## [X.Y.Z] — YYYY-MM-DD`.
   - Add a fresh empty `## [Unreleased]` block above it.
   - Update the link references at the bottom of the file:
     ```
     [Unreleased]: https://github.com/<org>/aegis/compare/vX.Y.Z...HEAD
     [X.Y.Z]: https://github.com/<org>/aegis/compare/vPREV...vX.Y.Z
     ```

4. **Sanity check.**
   ```bash
   npm ci
   npm run build
   npm run lint
   ```
   Don't release with a red CI badge.

5. **Write release notes.** Use the new CHANGELOG section — pull the bullets into the GitHub release body. Highlight any **migrations operators must apply** and **new env vars they must set** in a callout at the top. Operators reading the release notes need to know what action is required to upgrade.

6. **Commit, tag, push.**
   ```bash
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "Release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

7. **Create the GitHub release.**
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file - <<'EOF'
   ## Highlights
   - …

   ## Migrations / operator actions
   - …

   ## Full changelog
   See [CHANGELOG.md](./CHANGELOG.md).
   EOF
   ```

8. **Verify the deploy on at least one Supabase project.** Run `./scripts/deploy-aegis.sh` (or `.ps1`) against a staging project; confirm `supabase db push` applied the new migrations and every modified edge function deployed cleanly.

## Hot-fix process

If a critical bug ships in `vX.Y.0`:

1. Branch from the tag: `git checkout -b hotfix/X.Y.1 vX.Y.0`.
2. Cherry-pick the fix from `main`, or commit it directly if `main` has diverged too far.
3. Bump to `vX.Y.1`, update CHANGELOG, tag, push.
4. Open a PR back to `main` if the fix didn't originate there.

Don't let a hot-fix branch live longer than the actual fix takes — long-lived release branches are a maintenance burden and will eventually drift.

## What NOT to release

- A migration that's been applied to your dev project but never tested against a fresh Supabase project. Spin up a throwaway project, run `supabase db push` from scratch, and confirm every migration applies in order.
- An edge function whose code references an env var that isn't documented in [README.md](./README.md). Operators won't know to set it.
- A change that breaks an existing portal user's session. The portal is customer-visible; surprises there cost MSPs trust with their clients.
