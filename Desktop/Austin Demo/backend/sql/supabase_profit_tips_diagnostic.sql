-- Diagnostic query to find discrepancies between profit and tips
-- This helps identify why sum(profit) != -sum(tips)

-- Query 1: Check if there are games where profit != -tips
CREATE OR REPLACE FUNCTION get_profit_tips_mismatch(
    start_date_param TIMESTAMP WITH TIME ZONE,
    end_date_param TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    game_code VARCHAR(255),
    player_id VARCHAR(255),
    profit DECIMAL(10, 2),
    tips DECIMAL(10, 2),
    difference DECIMAL(10, 2),
    date_started TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.game_code::VARCHAR(255),
        g.player_id::VARCHAR(255),
        g.profit::DECIMAL(10, 2),
        g.tips::DECIMAL(10, 2),
        (g.profit + g.tips)::DECIMAL(10, 2) AS difference,
        g.date_started
    FROM games g
    WHERE g.date_started >= start_date_param
      AND g.date_ended <= end_date_param
      AND ABS(g.profit + g.tips) > 0.01  -- Allow for small rounding differences
    ORDER BY ABS(g.profit + g.tips) DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Query 2: Compare totals including/excluding games without agents
CREATE OR REPLACE FUNCTION get_profit_tips_totals(
    start_date_param TIMESTAMP WITH TIME ZONE,
    end_date_param TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    category VARCHAR(255),
    total_profit DECIMAL(10, 2),
    total_tips DECIMAL(10, 2),
    difference DECIMAL(10, 2),
    game_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    -- All games
    SELECT 
        'All Games'::VARCHAR(255) AS category,
        COALESCE(SUM(g.profit), 0)::DECIMAL(10, 2) AS total_profit,
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips,
        COALESCE(SUM(g.profit + g.tips), 0)::DECIMAL(10, 2) AS difference,
        COUNT(*)::BIGINT AS game_count
    FROM games g
    WHERE g.date_started >= start_date_param
      AND g.date_ended <= end_date_param
    
    UNION ALL
    
    -- Games with players mapped to agents (what agent report includes)
    SELECT 
        'Games with Agent Mapping'::VARCHAR(255) AS category,
        COALESCE(SUM(g.profit), 0)::DECIMAL(10, 2) AS total_profit,
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips,
        COALESCE(SUM(g.profit + g.tips), 0)::DECIMAL(10, 2) AS difference,
        COUNT(*)::BIGINT AS game_count
    FROM games g
    INNER JOIN players p ON g.player_id = p.player_id::TEXT
    WHERE g.date_started >= start_date_param
      AND g.date_ended <= end_date_param
      AND p.agent_id IS NOT NULL
    
    UNION ALL
    
    -- Games without agent mapping (excluded from agent report)
    SELECT 
        'Games without Agent Mapping'::VARCHAR(255) AS category,
        COALESCE(SUM(g.profit), 0)::DECIMAL(10, 2) AS total_profit,
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips,
        COALESCE(SUM(g.profit + g.tips), 0)::DECIMAL(10, 2) AS difference,
        COUNT(*)::BIGINT AS game_count
    FROM games g
    LEFT JOIN players p ON g.player_id = p.player_id::TEXT
    WHERE g.date_started >= start_date_param
      AND g.date_ended <= end_date_param
      AND (p.player_id IS NULL OR p.agent_id IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_profit_tips_mismatch(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_profit_tips_totals(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
