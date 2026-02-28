-- Migration to add hands column to games table if it doesn't exist
-- This column stores the number of hands played in each game

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'games' 
        AND column_name = 'hands'
    ) THEN
        ALTER TABLE games ADD COLUMN hands INTEGER;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_games_hands ON games(hands);
        
        -- Set default value for existing rows (if any)
        UPDATE games SET hands = 0 WHERE hands IS NULL;
        
        -- Make it NOT NULL after setting defaults
        ALTER TABLE games ALTER COLUMN hands SET NOT NULL;
        ALTER TABLE games ALTER COLUMN hands SET DEFAULT 0;
    END IF;
END $$;

