-- SQL function to get agent report grouped by real name
-- This groups players by their real_name from the real_name_mapping table

CREATE OR REPLACE FUNCTION get_agent_report_by_real_name(
    start_date_param TIMESTAMP WITH TIME ZONE,
    end_date_param TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    agent_id INTEGER,
    agent_name VARCHAR(255),
    deal_percent DECIMAL(10, 3),
    real_name VARCHAR(255),
    player_ids TEXT, -- Comma-separated list of player IDs for this real name
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
    ),
    player_data AS (
        SELECT 
            a.agent_id,
            a.agent_name,
            COALESCE(
                (SELECT r.deal_percent 
                 FROM agent_deal_percent_rules r
                 WHERE r.agent_id = a.agent_id 
                   AND r.threshold <= pt.total_tips
                 ORDER BY r.threshold DESC
                 LIMIT 1),
                a.deal_percent
            ) AS deal_percent,
            COALESCE(rnm.real_name, g.player_id) AS real_name,
            g.player_id,
            COALESCE(SUM(g.hands), 0)::BIGINT AS total_hands,
            COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips,
            COALESCE(SUM(g.tips * get_deal_percent(a.agent_id, g.tips)), 0)::DECIMAL(10, 2) AS agent_tips
        FROM agents a
        INNER JOIN players p ON a.agent_id = p.agent_id
        INNER JOIN games g ON g.player_id = p.player_id::TEXT
        INNER JOIN player_totals pt ON pt.agent_id = a.agent_id AND pt.player_id = g.player_id
        LEFT JOIN real_name_mapping rnm ON rnm.player_id = g.player_id AND rnm.agent_id = a.agent_id
        WHERE g.date_started >= start_date_param
          AND g.date_ended <= end_date_param
          AND p.agent_id IS NOT NULL
          AND p.player_id IS NOT NULL
        GROUP BY a.agent_id, a.agent_name, a.deal_percent, g.player_id, pt.total_tips, rnm.real_name
    )
    SELECT 
        agent_id::INTEGER,
        agent_name::VARCHAR(255),
        deal_percent::DECIMAL(10, 3),
        real_name::VARCHAR(255),
        STRING_AGG(DISTINCT player_id, ', ' ORDER BY player_id)::TEXT AS player_ids,
        SUM(total_hands)::BIGINT AS total_hands,
        SUM(total_tips)::DECIMAL(10, 2) AS total_tips,
        SUM(agent_tips)::DECIMAL(10, 2) AS agent_tips
    FROM player_data
    GROUP BY agent_id, agent_name, deal_percent, real_name
    ORDER BY agent_id, real_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_agent_report_by_real_name(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

