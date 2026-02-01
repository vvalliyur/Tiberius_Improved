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
    SELECT 
        a.agent_id::INTEGER,
        a.agent_name::VARCHAR(255),
        -- Use the deal_percent from the rule that applies to the total tips for this player
        -- This is an average/representative deal_percent for display purposes
        COALESCE(
            (SELECT deal_percent 
             FROM agent_deal_percent_rules 
             WHERE agent_id = a.agent_id 
               AND (player_id = p.player_id OR player_id IS NULL)
               AND threshold <= COALESCE(SUM(g.tips), 0)
             ORDER BY 
                 CASE WHEN player_id = p.player_id THEN 0 ELSE 1 END, -- Prefer player-specific
                 threshold DESC
             LIMIT 1),
            a.deal_percent
        )::DECIMAL(10, 3) AS deal_percent,
        g.player_id::VARCHAR(255),
        p.player_name::VARCHAR(255),
        COUNT(g.*)::BIGINT AS total_hands,
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips,
        -- Calculate agent_tips per game using rules, then sum
        COALESCE(SUM(g.tips * get_deal_percent(a.agent_id, p.player_id, g.tips)), 0)::DECIMAL(10, 2) AS agent_tips
    FROM agents a
    INNER JOIN players p ON a.agent_id = p.agent_id
    INNER JOIN games g ON g.player_id = p.player_id::TEXT
    WHERE g.date_started >= start_date_param
      AND g.date_ended <= end_date_param
      AND p.agent_id IS NOT NULL
      AND p.player_id IS NOT NULL
    GROUP BY a.agent_id, a.agent_name, a.deal_percent, g.player_id, p.player_name, p.player_id
    ORDER BY a.agent_id, g.player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_detailed_agent_report(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
