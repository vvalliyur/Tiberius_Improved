-- SQL functions to detect data quality errors
-- Simple functions to identify data that needs to be fixed

-- 1. Player IDs in games table that are not in players table
-- These are new players who have game records but have not been created as players yet
-- Note: player_id in games and players are both VARCHAR(255)
CREATE OR REPLACE FUNCTION get_players_in_games_not_in_players()
RETURNS TABLE (
    player_id VARCHAR(255),
    player_name VARCHAR(255),
    game_count BIGINT,
    total_tips DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.player_id::VARCHAR(255) AS player_id,
        MAX(g.player_name)::VARCHAR(255) AS player_name,
        COUNT(*)::BIGINT AS game_count,
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips
    FROM games g
    WHERE NOT EXISTS (
        SELECT 1 
        FROM players p 
        WHERE p.player_id = g.player_id
    )
    GROUP BY g.player_id
    ORDER BY COUNT(*) DESC, g.player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Players in players table that are not mapped to agents
-- Players that exist but have NULL agent_id or invalid agent_id
CREATE OR REPLACE FUNCTION get_players_not_mapped_to_agents()
RETURNS TABLE (
    player_id VARCHAR(255),
    player_name VARCHAR(255),
    agent_id INTEGER,
    error_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.player_id::VARCHAR(255) AS player_id,
        p.player_name::VARCHAR(255) AS player_name,
        p.agent_id::INTEGER AS agent_id,
        CASE 
            WHEN p.agent_id IS NULL THEN 'Player has no agent_id assigned'::TEXT
            WHEN a.agent_id IS NULL THEN 'Player references agent_id that does not exist'::TEXT
            ELSE 'Unknown error'::TEXT
        END AS error_description
    FROM players p
    LEFT JOIN agents a ON (p.agent_id = a.agent_id)
    WHERE (p.agent_id IS NULL) OR (a.agent_id IS NULL)
    ORDER BY p.player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Agents that are not mapped to deal rules
-- Agents that don't have any entries in agent_deal_percent_rules table
CREATE OR REPLACE FUNCTION get_agents_not_mapped_to_deal_rules()
RETURNS TABLE (
    agent_id INTEGER,
    agent_name VARCHAR(255),
    default_deal_percent DECIMAL(10, 3),
    rule_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH rule_counts AS (
        SELECT 
            adpr.agent_id AS rule_agent_id, 
            COUNT(*)::BIGINT AS rule_count
        FROM agent_deal_percent_rules adpr
        GROUP BY adpr.agent_id
    )
    SELECT 
        a.agent_id::INTEGER AS agent_id,
        a.agent_name::VARCHAR(255) AS agent_name,
        a.deal_percent::DECIMAL(10, 3) AS default_deal_percent,
        COALESCE(rc.rule_count, 0)::BIGINT AS rule_count
    FROM agents a
    LEFT JOIN rule_counts rc ON (a.agent_id = rc.rule_agent_id)
    WHERE COALESCE(rc.rule_count, 0) = 0
    ORDER BY a.agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_players_in_games_not_in_players() TO authenticated;
GRANT EXECUTE ON FUNCTION get_players_not_mapped_to_agents() TO authenticated;
GRANT EXECUTE ON FUNCTION get_agents_not_mapped_to_deal_rules() TO authenticated;
