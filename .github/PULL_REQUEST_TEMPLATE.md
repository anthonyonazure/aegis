<!--
Thanks for sending a pull request. Please fill out the sections below.
Replace the placeholder text with your content; don't delete the section
headers — they help reviewers scan quickly.
-->

## Summary

<!-- One paragraph: what does this PR do, and why? -->

## Type of change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation only
- [ ] Schema migration (also touches `supabase/migrations/`)
- [ ] New edge function
- [ ] Refactor (no behavior change)

## Operator-facing impact

<!--
What does the person deploying Aegis need to do after merging this?
- New env vars?
- New Supabase secrets?
- New manual SQL?
- Cron registration?
- DNS / SSL?

If "none", say so explicitly. If there are steps, add them to HANDOFF.md.
-->

- [ ] None — pure code change
- [ ] HANDOFF.md updated with required deploy steps

## Testing

<!--
How did you test this? "It builds" is not testing.
- For UI: which flows did you click through?
- For edge functions: did you invoke them against a real tenant?
- For migrations: did you apply them to a fresh project?
-->

## Checklist

- [ ] My code follows the conventions in [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] I have added/updated tests where relevant
- [ ] CI passes (lint + build)
- [ ] I have updated [CHANGELOG.md](../CHANGELOG.md) under `[Unreleased]`
- [ ] If this PR adds a migration, I confirmed it applies cleanly to a fresh Supabase project
- [ ] If this PR adds a new edge function, it's listed in `supabase/config.toml` AND `scripts/deploy-aegis.{ps1,sh}`
- [ ] If this PR adds a new env var, it's documented in [README.md](../README.md)
