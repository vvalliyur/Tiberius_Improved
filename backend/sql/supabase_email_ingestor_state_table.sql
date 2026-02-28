-- Email Ingestor State Table
-- Stores the last run time for the email ingestor to avoid reprocessing emails

CREATE TABLE IF NOT EXISTS email_ingestor_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_run_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_ingestor_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_email_ingestor_state_updated_at 
    BEFORE UPDATE ON email_ingestor_state
    FOR EACH ROW 
    EXECUTE FUNCTION update_email_ingestor_state_updated_at();

