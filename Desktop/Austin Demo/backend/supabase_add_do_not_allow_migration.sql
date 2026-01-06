-- Migration: Add is_blocked column to players table
-- Run this SQL in your Supabase SQL editor to add the column to existing databases

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

