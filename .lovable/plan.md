

## Problem Identified

The secure score fetch **is working** -- it successfully retrieves data from Microsoft Graph. However, it **fails to save** for one tenant ("Tesoro XP, Inc.") because of a database column overflow.

**Root cause:** The `current_score` and `max_score` columns in both `tenant_secure_scores` and `secure_score_history` are defined as `NUMERIC(5,2)`, which caps at **999.99**. Microsoft Graph returned `currentScore: 574.75` and `maxScore: 1170` for this tenant -- the `max_score` of 1170 exceeds the limit.

The other two tenants (scores ~88 and ~122) saved fine because their values fit within 999.99.

Edge function log confirms:
```
numeric field overflow
A field with precision 5, scale 2 must round to an absolute value less than 10^3.
```

## Fix

**Database migration** -- widen the numeric columns to `NUMERIC(10,2)` (supports up to 99,999,999.99):

1. `tenant_secure_scores.current_score` -- ALTER to `NUMERIC(10,2)`
2. `tenant_secure_scores.max_score` -- ALTER to `NUMERIC(10,2)`
3. `tenant_secure_scores.score_percentage` -- keep or widen to `NUMERIC(7,2)` (percentage could theoretically exceed 999 in edge cases with bad data)
4. `secure_score_history.score` -- ALTER to `NUMERIC(10,2)`
5. `secure_score_history.max_score` -- ALTER to `NUMERIC(10,2)`

No code changes needed -- the edge function and client code are correct. Only the column precision is too small.

