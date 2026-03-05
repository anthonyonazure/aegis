
-- Drop generated column first
ALTER TABLE tenant_secure_scores DROP COLUMN score_percentage;

-- Now widen the numeric columns
ALTER TABLE tenant_secure_scores ALTER COLUMN current_score TYPE NUMERIC(10,2);
ALTER TABLE tenant_secure_scores ALTER COLUMN max_score TYPE NUMERIC(10,2);

-- Recreate generated column with wider precision
ALTER TABLE tenant_secure_scores ADD COLUMN score_percentage NUMERIC(7,2) GENERATED ALWAYS AS (
  CASE WHEN max_score > 0 THEN (current_score / max_score) * 100 ELSE 0 END
) STORED;

-- Widen secure_score_history columns
ALTER TABLE secure_score_history ALTER COLUMN score TYPE NUMERIC(10,2);
ALTER TABLE secure_score_history ALTER COLUMN max_score TYPE NUMERIC(10,2);
