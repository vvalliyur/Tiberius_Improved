-- SQL function to get detailed agent report grouped by agent and player
-- Returns data for each agent showing all their players with game statistics
-- Updated to use deal_percent_rules table with per-game calculation

-- Drop the existing function first if it exists (required when changing return type)
DROP FUNCTION IF EXISTS get_detailed_agent_report(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);

CREATE OR REPLACE FUNCTION get_detailed_agent_report(
    start_date_param TIMESTAMP WITH TIME ZONE,
    end_date_param TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    agent_id INTEGER,
    agent_name VARCHAR(255),
    deal_percent DECIMAL(10, 3),
    player_id VARCHAR(255),
    player_name VARCHAR(255),
    total_hands BIGINT,
    total_tips DECIMAL(10, 2),
    agent_tips DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH player_totals AS (
        SELECT 
            a.agent_id,
            g.player_id,
            SUM(g.tips) AS total_tips
        FROM agents a
        INNER JOIN players p ON a.agent_id = p.agent_id
        INNER JOIN games g ON g.player_id = p.player_id::TEXT
        WHERE g.date_started >= start_date_param
          AND g.date_ended <= end_date_param
          AND p.agent_id IS NOT NULL
          AND p.player_id IS NOT NULL
        GROUP BY a.agent_id, g.player_id
    )
    SELECT 
        a.agent_id::INTEGER,
        a.agent_name::VARCHAR(255),
        -- Calculate deal_percent for each player based on their total tips
        -- This represents the deal_percent that applies to the player's total tips amount
        COALESCE(
            (SELECT r.deal_percent 
             FROM agent_deal_percent_rules r
             WHERE r.agent_id = a.agent_id 
               AND r.threshold <= pt.total_tips
             ORDER BY r.threshold DESC
             LIMIT 1),
            a.deal_percent
        )::DECIMAL(10, 3) AS deal_percent,
        g.player_id::VARCHAR(255),
        p.player_name::VARCHAR(255),
        COUNT(g.*)::BIGINT AS total_hands,
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips,
        -- Calculate agent_tips per game using rules, then sum
        -- Each game uses the deal_percent that applies to that specific game's tips
        COALESCE(SUM(g.tips * get_deal_percent(a.agent_id, g.tips)), 0)::DECIMAL(10, 2) AS agent_tips
    FROM agents a
    INNER JOIN players p ON a.agent_id = p.agent_id
    INNER JOIN games g ON g.player_id = p.player_id::TEXT
    INNER JOIN player_totals pt ON pt.agent_id = a.agent_id AND pt.player_id = g.player_id
    WHERE g.date_started >= start_date_param
      AND g.date_ended <= end_date_param
      AND p.agent_id IS NOT NULL
      AND p.player_id IS NOT NULL
    GROUP BY a.agent_id, a.agent_name, a.deal_percent, g.player_id, p.player_name, p.player_id, pt.total_tips
    ORDER BY a.agent_id, g.player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_detailed_agent_report(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
