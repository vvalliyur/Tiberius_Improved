-- SQL function to get detailed agent report grouped by real name
-- This groups players by their real_name from the real_name_mapping table
-- Players without a real_name mapping will be grouped by their player_id

CREATE OR REPLACE FUNCTION get_detailed_agent_report_by_real_name(
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
    WITH player_data AS (
        SELECT 
            a.agent_id,
            a.agent_name,
            a.deal_percent AS default_deal_percent,
            -- Get real_name from mapping, fallback to player_id if no mapping exists
            COALESCE(rnm.real_name, g.player_id) AS real_name,
            g.player_id,
            -- Sum the actual hands column from each game, not count games
            COALESCE(SUM(COALESCE(g.hands, 0)), 0)::BIGINT AS total_hands,
            COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips
        FROM agents a
        INNER JOIN players p ON a.agent_id = p.agent_id
        INNER JOIN games g ON g.player_id = p.player_id::TEXT
        LEFT JOIN real_name_mapping rnm ON rnm.player_id = g.player_id AND rnm.agent_id = a.agent_id
        WHERE g.date_started >= start_date_param
          AND g.date_ended <= end_date_param
          AND p.agent_id IS NOT NULL
          AND p.player_id IS NOT NULL
        GROUP BY a.agent_id, a.agent_name, a.deal_percent, g.player_id, rnm.real_name
    ),
    real_name_totals AS (
        SELECT 
            pd2.agent_id AS rnt_agent_id,
            pd2.real_name AS rnt_real_name,
            SUM(pd2.total_tips) AS total_tips_for_real_name
        FROM player_data pd2
        GROUP BY pd2.agent_id, pd2.real_name
    ),
    real_name_deal_percents AS (
        SELECT 
            rnt.rnt_agent_id AS agent_id,
            rnt.rnt_real_name AS real_name,
            rnt.total_tips_for_real_name,
            -- Calculate deal_percent based on real_name group's total tips
            COALESCE(
                (SELECT r.deal_percent 
                 FROM agent_deal_percent_rules r
                 WHERE r.agent_id = rnt.rnt_agent_id 
                   AND r.threshold <= rnt.total_tips_for_real_name
                 ORDER BY r.threshold DESC
                 LIMIT 1),
                a.deal_percent
            ) AS deal_percent
        FROM real_name_totals rnt
        INNER JOIN agents a ON a.agent_id = rnt.rnt_agent_id
    )
    SELECT 
        pd.agent_id::INTEGER AS agent_id,
        pd.agent_name::VARCHAR(255) AS agent_name,
        rndp.deal_percent::DECIMAL(10, 3) AS deal_percent,
        pd.real_name::VARCHAR(255) AS real_name,
        STRING_AGG(DISTINCT pd.player_id, ', ' ORDER BY pd.player_id)::TEXT AS player_ids,
        SUM(pd.total_hands)::BIGINT AS total_hands,
        SUM(pd.total_tips)::DECIMAL(10, 2) AS total_tips,
        -- Calculate agent_tips using the deal_percent based on total tips for the real_name group
        SUM(pd.total_tips)::DECIMAL(10, 2) * rndp.deal_percent::DECIMAL(10, 3) AS agent_tips
    FROM player_data pd
    INNER JOIN real_name_totals rnt ON rnt.rnt_agent_id = pd.agent_id AND rnt.rnt_real_name = pd.real_name
    INNER JOIN real_name_deal_percents rndp ON rndp.agent_id = pd.agent_id AND rndp.real_name = pd.real_name
    GROUP BY pd.agent_id, pd.agent_name, pd.real_name, rndp.deal_percent
    ORDER BY pd.agent_id, pd.real_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_detailed_agent_report_by_real_name(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
