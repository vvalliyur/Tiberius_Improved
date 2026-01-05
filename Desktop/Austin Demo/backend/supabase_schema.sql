-- Poker Accounting System Database Schema for Supabase
-- Based on GameDataS, AgentS, and PlayerS Pandera schemas
-- Run this SQL in your Supabase SQL editor to create the tables

-- Agents Table
CREATE TABLE IF NOT EXISTS agents (
    agent_id SERIAL PRIMARY KEY,
    agent_name VARCHAR(255) NOT NULL,
    deal_percent DECIMAL(10, 3) NOT NULL,
    comm_channel VARCHAR(255),
    notes TEXT,
    payment_methods TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Players Table
CREATE TABLE IF NOT EXISTS players (
    player_id SERIAL PRIMARY KEY,
    player_name VARCHAR(255) NOT NULL,
    agent_id INTEGER REFERENCES agents(agent_id) ON DELETE SET NULL,
    credit_limit DECIMAL(10, 2),
    notes TEXT,
    comm_channel VARCHAR(255),
    payment_methods TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Foreign key constraint already exists: agent_id REFERENCES agents(agent_id)

-- Games Table (based on GameDataS)
-- Composite primary key: (game_code, date_started, date_ended, player_id, profit, tips, total_tips)
CREATE TABLE IF NOT EXISTS games (
    rank INTEGER NOT NULL,
    game_code VARCHAR(255) NOT NULL,
    club_code VARCHAR(255) NOT NULL,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    date_started TIMESTAMP WITH TIME ZONE NOT NULL,
    date_ended TIMESTAMP WITH TIME ZONE NOT NULL,
    game_type VARCHAR(255) NOT NULL,
    big_blind DECIMAL(10, 2) NOT NULL,
    profit DECIMAL(10, 2) NOT NULL,
    tips DECIMAL(10, 2) NOT NULL,
    buy_in DECIMAL(10, 2) NOT NULL,
    total_tips DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (game_code, date_started, date_ended, player_id, profit, tips, total_tips)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_games_player_id ON games(player_id);
CREATE INDEX IF NOT EXISTS idx_games_club_code ON games(club_code);
CREATE INDEX IF NOT EXISTS idx_games_date_started ON games(date_started);
CREATE INDEX IF NOT EXISTS idx_games_date_ended ON games(date_ended);
CREATE INDEX IF NOT EXISTS idx_games_date_range ON games(date_started, date_ended);
CREATE INDEX IF NOT EXISTS idx_games_game_code ON games(game_code);
CREATE INDEX IF NOT EXISTS idx_players_agent_id ON players(agent_id);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to auto-update updated_at for agents and players
CREATE TRIGGER update_agents_updated_at 
    BEFORE UPDATE ON agents
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Uploaded CSVs tracking table
CREATE TABLE IF NOT EXISTS uploaded_csvs (
    id SERIAL PRIMARY KEY,
    csv_hash VARCHAR(64) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    row_count INTEGER NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_csvs_hash ON uploaded_csvs(csv_hash);

-- User username mapping table (for username-based authentication)
CREATE TABLE IF NOT EXISTS user_usernames (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_usernames_username ON user_usernames(username);
CREATE INDEX IF NOT EXISTS idx_user_usernames_user_id ON user_usernames(user_id);

-- Function to get email by username
CREATE OR REPLACE FUNCTION get_email_by_username(username_param VARCHAR)
RETURNS TABLE(email TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT au.email::TEXT
    FROM auth.users au
    INNER JOIN user_usernames uu ON au.id = uu.user_id
    WHERE uu.username = username_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
