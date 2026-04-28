-- Migration: add_platform_benchmarks_function
-- Already applied to Supabase project dsnkabdmposyukcedduy

CREATE OR REPLACE FUNCTION get_platform_benchmarks()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  result JSON;
BEGIN
  SELECT COUNT(DISTINCT user_id) INTO user_count FROM networking_weeks;

  IF user_count < 5 THEN
    RETURN json_build_object(
      'hasEnoughUsers', false,
      'userCount', user_count,
      'requiredCount', 5
    );
  END IF;

  SELECT json_build_object(
    'hasEnoughUsers', true,
    'userCount', user_count,
    'requestsSent',   ROUND(AVG(requests_sent)),
    'acceptanceRate', ROUND(AVG(acceptance_rate)),
    'messagesSent',   ROUND(AVG(messages_sent)),
    'catchupsBooked', ROUND(AVG(catchups_booked))
  ) INTO result
  FROM networking_weeks
  WHERE week_key >= CURRENT_DATE - INTERVAL '12 weeks';

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_platform_benchmarks() TO anon, authenticated;
