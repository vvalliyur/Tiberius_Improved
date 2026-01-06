-- Migration: Add weekly_credit_adjustment column to players table
-- Run this SQL in your Supabase SQL editor to add the column to existing databases

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS weekly_credit_adjustment DECIMAL(10, 2) NOT NULL DEFAULT 0;

