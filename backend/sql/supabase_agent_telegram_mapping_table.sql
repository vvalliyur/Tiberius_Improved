-- Agent Telegram Mapping Table
-- Maps agent_id to Telegram chat_id for sending messages

CREATE TABLE IF NOT EXISTS agent_telegram_mapping (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL UNIQUE REFERENCES agents(agent_id) ON DELETE CASCADE,
    chat_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_agent_telegram_mapping UNIQUE (agent_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_agent_telegram_mapping_agent_id ON agent_telegram_mapping(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_telegram_mapping_chat_id ON agent_telegram_mapping(chat_id);

-- Trigger to auto-update updated_at timestamp
CREATE TRIGGER update_agent_telegram_mapping_updated_at
    BEFORE UPDATE ON agent_telegram_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_telegram_mapping TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE agent_telegram_mapping_id_seq TO authenticated;

