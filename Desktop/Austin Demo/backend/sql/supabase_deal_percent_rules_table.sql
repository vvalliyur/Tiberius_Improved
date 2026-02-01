-- Deal Percent Rules Table
-- Stores conditional deal_percent rules for agents and optionally specific players
-- Rules are applied when tips >= threshold: highest threshold <= amount wins

CREATE TABLE IF NOT EXISTS agent_deal_percent_rules (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    threshold DECIMAL(10, 2) NOT NULL,
    deal_percent DECIMAL(10, 3) NOT NULL CHECK (deal_percent >= 0 AND deal_percent <= 1),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- Ensure unique thresholds per agent/player combination
    CONSTRAINT unique_agent_player_threshold UNIQUE (agent_id, threshold)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_percent_rules_agent_id ON agent_deal_percent_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_deal_percent_rules_agent_player ON agent_deal_percent_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_deal_percent_rules_threshold ON agent_deal_percent_rules(agent_id, threshold DESC);

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_deal_percent_rules_updated_at 
    BEFORE UPDATE ON agent_deal_percent_rules
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Helper function to get the applicable deal_percent for a given agent, player, and amount
-- Priority: player-specific rules > agent-specific rules > default agent deal_percent
CREATE OR REPLACE FUNCTION get_deal_percent(
    p_agent_id INTEGER,
    p_amount DECIMAL(10, 2)
)
RETURNS DECIMAL(10, 3) AS $$
DECLARE
    v_deal_percent DECIMAL(10, 3);
BEGIN
    -- Rule applies when tips >= threshold
    SELECT deal_percent INTO v_deal_percent
    FROM agent_deal_percent_rules
    WHERE agent_id = p_agent_id
      AND p_amount >= threshold
    ORDER BY threshold DESC
    LIMIT 1;
    
    -- If still no rule found, return the default deal_percent from agents table
    IF v_deal_percent IS NULL THEN
        SELECT deal_percent INTO v_deal_percent
        FROM agents
        WHERE agent_id = p_agent_id;
    END IF;
    
    RETURN COALESCE(v_deal_percent, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_deal_percent(INTEGER, INTEGER, DECIMAL(10, 2)) TO authenticated;

