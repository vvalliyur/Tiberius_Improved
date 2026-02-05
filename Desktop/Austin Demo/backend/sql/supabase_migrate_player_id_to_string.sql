-- Migration: Change player_id from INTEGER/SERIAL to VARCHAR(255)
-- This migration converts the players table player_id from auto-incrementing integer to string

-- Step 1: Drop the existing primary key constraint
ALTER TABLE IF EXISTS players DROP CONSTRAINT IF EXISTS players_pkey;

-- Step 2: Change the column type from SERIAL/INTEGER to VARCHAR(255)
-- Note: This will convert existing integer IDs to strings
ALTER TABLE players 
ALTER COLUMN player_id TYPE VARCHAR(255) USING player_id::VARCHAR(255);

-- Step 3: Remove the SERIAL sequence if it exists (it will be auto-dropped, but we can be explicit)
DROP SEQUENCE IF EXISTS players_player_id_seq;

-- Step 4: Re-add the primary key constraint
ALTER TABLE players ADD PRIMARY KEY (player_id);

-- Step 5: Update any foreign key references if they exist
-- Note: Check if there are any foreign keys pointing to players.player_id
-- If games table has a foreign key, it may need updating too

-- Step 6: Update indexes (they should remain valid, but we can recreate if needed)
-- The existing index on player_id should still work

