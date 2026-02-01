-- SQL function to get agent report with joins at database level
-- This replaces the 3 separate queries with a single optimized query
-- Note: games.player_id is VARCHAR, players.player_id is INTEGER, so we cast for the join
-- Updated to use deal_percent_rules table with per-game calculation

CREATE OR REPLACE FUNCTION get_agent_report(
    start_date_param TIMESTAMP WITH TIME ZONE,
    end_date_param TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    agent_id INTEGER,
    agent_name VARCHAR(255),
    total_profit DECIMAL(10, 2),
    total_tips DECIMAL(10, 2),
    agent_tips DECIMAL(10, 2),
    game_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id,
        a.agent_name,
        COALESCE(SUM(g.profit), 0)::DECIMAL(10, 2) AS total_profit,
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips,
        -- Calculate agent_tips per game using rules, then sum
        COALESCE(SUM(g.tips * get_deal_percent(a.agent_id, p.player_id, g.tips)), 0)::DECIMAL(10, 2) AS agent_tips,
        COUNT(g.*)::BIGINT AS game_count
    FROM agents a
    INNER JOIN players p ON a.agent_id = p.agent_id
    INNER JOIN games g ON g.player_id = p.player_id::TEXT
    WHERE g.date_started >= start_date_param
      AND g.date_ended <= end_date_param
      AND p.agent_id IS NOT NULL
    GROUP BY a.agent_id, a.agent_name
    ORDER BY a.agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_agent_report(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
