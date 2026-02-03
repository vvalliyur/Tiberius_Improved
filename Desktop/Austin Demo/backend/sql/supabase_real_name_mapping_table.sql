-- SQL migration to create the real_name_mapping table
-- This table maps player IDs to their "real names" for display purposes

CREATE TABLE IF NOT EXISTS real_name_mapping (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    agent_id INTEGER NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
    real_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_player_agent_real_name UNIQUE (player_id, agent_id, real_name)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_real_name_mapping_player_id ON real_name_mapping(player_id);
CREATE INDEX IF NOT EXISTS idx_real_name_mapping_agent_id ON real_name_mapping(agent_id);
CREATE INDEX IF NOT EXISTS idx_real_name_mapping_real_name ON real_name_mapping(real_name);
CREATE INDEX IF NOT EXISTS idx_real_name_mapping_player_agent ON real_name_mapping(player_id, agent_id);

-- Trigger to auto-update updated_at timestamp
CREATE TRIGGER update_real_name_mapping_updated_at
    BEFORE UPDATE ON real_name_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON real_name_mapping TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE real_name_mapping_id_seq TO authenticated;

