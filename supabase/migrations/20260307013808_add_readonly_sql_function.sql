CREATE OR REPLACE FUNCTION exec_readonly_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  normalized text;
BEGIN
  -- Normalize and validate: only SELECT allowed
  normalized := btrim(query);
  IF NOT (upper(normalized) LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous keywords even inside SELECT
  IF upper(normalized) ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY)' THEN
    RAISE EXCEPTION 'Query contains disallowed keywords';
  END IF;

  -- Execute and return as JSON array
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', normalized) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
