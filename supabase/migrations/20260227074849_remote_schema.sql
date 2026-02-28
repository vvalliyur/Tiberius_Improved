


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) RETURNS TABLE("agent_id" integer, "agent_name" character varying, "total_profit" numeric, "total_tips" numeric, "agent_tips" numeric, "game_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id,
        a.agent_name,
        COALESCE(SUM(g.profit), 0)::DECIMAL(10, 2) AS total_profit,
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips,
        -- Calculate agent_tips per game using rules, then sum
        -- Handle NULL deal_percent by using COALESCE on the function result
        COALESCE(SUM(g.tips * COALESCE(get_deal_percent(a.agent_id, g.tips), a.deal_percent, 0)), 0)::DECIMAL(10, 2) AS agent_tips,
        COUNT(g.*)::BIGINT AS game_count
    FROM agents a
    INNER JOIN players p ON a.agent_id = p.agent_id
    INNER JOIN games g ON g.player_id = p.player_id
    WHERE g.date_started >= start_date_param
      AND g.date_ended <= end_date_param
      AND p.agent_id IS NOT NULL
    GROUP BY a.agent_id, a.agent_name
    ORDER BY a.agent_id;
END;
$$;


ALTER FUNCTION "public"."get_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agents_not_mapped_to_deal_rules"() RETURNS TABLE("agent_id" integer, "agent_name" character varying, "default_deal_percent" numeric, "rule_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_agents_not_mapped_to_deal_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agents_without_deal_rules"() RETURNS TABLE("agent_id" integer, "agent_name" character varying, "default_deal_percent" numeric, "rule_count" bigint, "error_type" character varying, "error_description" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_id::INTEGER,
        a.agent_name::VARCHAR(255),
        a.deal_percent::DECIMAL(10, 3) AS default_deal_percent,
        COALESCE(rule_counts.rule_count, 0)::BIGINT AS rule_count,
        CASE 
            WHEN COALESCE(rule_counts.rule_count, 0) = 0 AND (a.deal_percent IS NULL OR a.deal_percent = 0) THEN 'NO_DEAL_PERCENT'
            WHEN COALESCE(rule_counts.rule_count, 0) = 0 AND a.deal_percent > 0 THEN 'NO_RULES_ONLY_DEFAULT'
            ELSE 'UNKNOWN'
        END::VARCHAR(255) AS error_type,
        CASE 
            WHEN COALESCE(rule_counts.rule_count, 0) = 0 AND (a.deal_percent IS NULL OR a.deal_percent = 0) THEN 'Agent has no deal_percent_rules and no valid default deal_percent'
            WHEN COALESCE(rule_counts.rule_count, 0) = 0 AND a.deal_percent > 0 THEN 'Agent has no deal_percent_rules (only default deal_percent exists)'
            ELSE 'Unknown error'
        END::TEXT AS error_description
    FROM agents a
    LEFT JOIN (
        SELECT agent_id, COUNT(*)::BIGINT AS rule_count
        FROM agent_deal_percent_rules
        GROUP BY agent_id
    ) rule_counts ON a.agent_id = rule_counts.agent_id
    WHERE COALESCE(rule_counts.rule_count, 0) = 0 AND (a.deal_percent IS NULL OR a.deal_percent = 0)
    ORDER BY a.agent_id;
END;
$$;


ALTER FUNCTION "public"."get_agents_without_deal_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_amount" numeric) RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
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
        SELECT COALESCE(deal_percent, 0) INTO v_deal_percent
        FROM agents
        WHERE agent_id = p_agent_id;
        
        -- If agent not found or deal_percent is still NULL, return 0
        IF v_deal_percent IS NULL THEN
            v_deal_percent := 0;
        END IF;
    END IF;
    
    RETURN v_deal_percent;
END;
$$;


ALTER FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_player_id" integer, "p_amount" numeric) RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_deal_percent DECIMAL(10, 3);
BEGIN
    -- First, try to find a player-specific rule
    -- Rule applies when tips >= threshold
    IF p_player_id IS NOT NULL THEN
        SELECT deal_percent INTO v_deal_percent
        FROM agent_deal_percent_rules
        WHERE agent_id = p_agent_id
          AND player_id = p_player_id
          AND p_amount >= threshold
        ORDER BY threshold DESC
        LIMIT 1;
        
        IF v_deal_percent IS NOT NULL THEN
            RETURN v_deal_percent;
        END IF;
    END IF;
    
    -- If no player-specific rule, try agent-specific rule
    -- Rule applies when tips >= threshold
    SELECT deal_percent INTO v_deal_percent
    FROM agent_deal_percent_rules
    WHERE agent_id = p_agent_id
      AND player_id IS NULL
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
$$;


ALTER FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_player_id" integer, "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_detailed_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) RETURNS TABLE("agent_id" integer, "agent_name" character varying, "deal_percent" numeric, "player_id" character varying, "player_name" character varying, "total_hands" bigint, "total_profit" numeric, "total_tips" numeric, "agent_tips" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH player_totals AS (
        SELECT 
            a.agent_id,
            g.player_id,
            SUM(g.tips) AS total_tips
        FROM agents a
        INNER JOIN players p ON a.agent_id = p.agent_id
        INNER JOIN games g ON g.player_id = p.player_id
        WHERE g.date_started >= start_date_param
          AND g.date_ended <= end_date_param
          AND p.agent_id IS NOT NULL
          AND p.player_id IS NOT NULL
        GROUP BY a.agent_id, g.player_id
    ),
    player_deal_percents AS (
        SELECT 
            pt.agent_id,
            pt.player_id,
            pt.total_tips,
            -- Calculate deal_percent based on player's total tips
            COALESCE(
                (SELECT r.deal_percent 
                 FROM agent_deal_percent_rules r
                 WHERE r.agent_id = pt.agent_id 
                   AND r.threshold <= pt.total_tips
                 ORDER BY r.threshold DESC
                 LIMIT 1),
                a.deal_percent,
                0
            ) AS deal_percent
        FROM player_totals pt
        INNER JOIN agents a ON a.agent_id = pt.agent_id
    )
    SELECT 
        a.agent_id::INTEGER,
        a.agent_name::VARCHAR(255),
        COALESCE(pdp.deal_percent, 0)::DECIMAL(10, 3) AS deal_percent,
        g.player_id::VARCHAR(255),
        p.player_name::VARCHAR(255),
        -- Sum the actual hands column from each game, not count games
        COALESCE(SUM(COALESCE(g.hands, 0)), 0)::BIGINT AS total_hands,
        COALESCE(SUM(g.profit), 0)::DECIMAL(10, 2) AS total_profit,
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips,
        -- Calculate agent_tips using the deal_percent based on total tips (not per-game)
        COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) * COALESCE(pdp.deal_percent, 0)::DECIMAL(10, 3) AS agent_tips
    FROM agents a
    INNER JOIN players p ON a.agent_id = p.agent_id
    INNER JOIN games g ON g.player_id = p.player_id
    INNER JOIN player_deal_percents pdp ON pdp.agent_id = a.agent_id AND pdp.player_id = g.player_id
    WHERE g.date_started >= start_date_param
      AND g.date_ended <= end_date_param
      AND p.agent_id IS NOT NULL
      AND p.player_id IS NOT NULL
    GROUP BY a.agent_id, a.agent_name, g.player_id, p.player_name, pdp.deal_percent
    ORDER BY a.agent_id, g.player_id;
END;
$$;


ALTER FUNCTION "public"."get_detailed_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_detailed_agent_report_by_real_name"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) RETURNS TABLE("agent_id" integer, "agent_name" character varying, "deal_percent" numeric, "real_name" character varying, "player_ids" "text", "total_hands" bigint, "total_profit" numeric, "total_tips" numeric, "agent_tips" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH player_data AS (
        SELECT 
            a.agent_id,
            a.agent_name,
            a.deal_percent AS default_deal_percent,
            -- Get real_name from mapping, fallback to player_id if no mapping exists
            COALESCE(rnm.real_name, g.player_id) AS real_name,
            g.player_id,
            -- Sum the actual hands column from each game, not count games
            COALESCE(SUM(COALESCE(g.hands, 0)), 0)::BIGINT AS total_hands,
            COALESCE(SUM(g.profit), 0)::DECIMAL(10, 2) AS total_profit,
            COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips
        FROM agents a
        INNER JOIN players p ON a.agent_id = p.agent_id
        INNER JOIN games g ON g.player_id = p.player_id
        LEFT JOIN real_name_mapping rnm ON rnm.player_id = g.player_id AND rnm.agent_id = a.agent_id
        WHERE g.date_started >= start_date_param
          AND g.date_ended <= end_date_param
          AND p.agent_id IS NOT NULL
          AND p.player_id IS NOT NULL
        GROUP BY a.agent_id, a.agent_name, a.deal_percent, g.player_id, rnm.real_name
    ),
    real_name_totals AS (
        SELECT 
            pd2.agent_id AS rnt_agent_id,
            pd2.real_name AS rnt_real_name,
            SUM(pd2.total_tips) AS total_tips_for_real_name
        FROM player_data pd2
        GROUP BY pd2.agent_id, pd2.real_name
    ),
    real_name_deal_percents AS (
        SELECT 
            rnt.rnt_agent_id AS agent_id,
            rnt.rnt_real_name AS real_name,
            rnt.total_tips_for_real_name,
            -- Calculate deal_percent based on real_name group's total tips
            COALESCE(
                (SELECT r.deal_percent 
                 FROM agent_deal_percent_rules r
                 WHERE r.agent_id = rnt.rnt_agent_id 
                   AND r.threshold <= rnt.total_tips_for_real_name
                 ORDER BY r.threshold DESC
                 LIMIT 1),
                a.deal_percent,
                0
            ) AS deal_percent
        FROM real_name_totals rnt
        INNER JOIN agents a ON a.agent_id = rnt.rnt_agent_id
    )
    SELECT 
        pd.agent_id::INTEGER AS agent_id,
        pd.agent_name::VARCHAR(255) AS agent_name,
        COALESCE(rndp.deal_percent, 0)::DECIMAL(10, 3) AS deal_percent,
        pd.real_name::VARCHAR(255) AS real_name,
        STRING_AGG(DISTINCT pd.player_id, ', ' ORDER BY pd.player_id)::TEXT AS player_ids,
        SUM(pd.total_hands)::BIGINT AS total_hands,
        SUM(pd.total_profit)::DECIMAL(10, 2) AS total_profit,
        SUM(pd.total_tips)::DECIMAL(10, 2) AS total_tips,
        -- Calculate agent_tips using the deal_percent based on total tips for the real_name group
        SUM(pd.total_tips)::DECIMAL(10, 2) * COALESCE(rndp.deal_percent, 0)::DECIMAL(10, 3) AS agent_tips
    FROM player_data pd
    INNER JOIN real_name_totals rnt ON rnt.rnt_agent_id = pd.agent_id AND rnt.rnt_real_name = pd.real_name
    INNER JOIN real_name_deal_percents rndp ON rndp.agent_id = pd.agent_id AND rndp.real_name = pd.real_name
    GROUP BY pd.agent_id, pd.agent_name, pd.real_name, rndp.deal_percent
    ORDER BY pd.agent_id, pd.real_name;
END;
$$;


ALTER FUNCTION "public"."get_detailed_agent_report_by_real_name"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_email_by_username"("username_param" character varying) RETURNS TABLE("email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT au.email::TEXT
    FROM auth.users au
    INNER JOIN user_usernames uu ON au.id = uu.user_id
    WHERE uu.username = username_param;
END;
$$;


ALTER FUNCTION "public"."get_email_by_username"("username_param" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_orphaned_game_players"() RETURNS TABLE("player_id" character varying, "player_name" character varying, "agent_id" integer, "agent_name" character varying, "game_count" bigint, "total_tips" numeric, "error_type" character varying, "error_description" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        result.game_player_id::VARCHAR(255),
        result.player_name::VARCHAR(255),
        result.player_agent_id::INTEGER,
        result.agent_name::VARCHAR(255),
        result.game_count::BIGINT,
        result.total_tips::DECIMAL(10, 2),
        result.error_type::VARCHAR(255),
        result.error_description::TEXT
    FROM (
        WITH game_players AS (
            SELECT 
                g.player_id,
                COUNT(g.*)::BIGINT AS game_count,
                COALESCE(SUM(g.tips), 0)::DECIMAL(10, 2) AS total_tips
            FROM games g
            GROUP BY g.player_id
        ),
        matched_data AS (
            SELECT 
                gp.player_id AS game_player_id,
                gp.game_count,
                gp.total_tips,
                p.player_id AS matched_player_id,
                p.player_name,
                p.agent_id AS player_agent_id,
                agents_table.agent_id AS matched_agent_id,
                agents_table.agent_name
            FROM game_players gp
            LEFT JOIN players p ON gp.player_id = p.player_id::TEXT
            LEFT JOIN agents AS agents_table ON (p.agent_id = agents_table.agent_id)
        )
        SELECT 
            md.game_player_id,
            COALESCE(md.player_name, 'NOT IN PLAYERS TABLE') AS player_name,
            md.player_agent_id,
            COALESCE(md.agent_name, 'NO AGENT') AS agent_name,
            md.game_count,
            md.total_tips,
            CASE 
                WHEN md.matched_player_id IS NULL THEN 'MISSING_IN_PLAYERS_TABLE'
                WHEN md.player_agent_id IS NULL THEN 'NO_AGENT_LINK'
                WHEN md.matched_agent_id IS NULL THEN 'INVALID_AGENT_LINK'
                ELSE 'UNKNOWN'
            END AS error_type,
            CASE 
                WHEN md.matched_player_id IS NULL THEN 'Player exists in games table but not in players table'
                WHEN md.player_agent_id IS NULL THEN 'Player exists but has no agent_id assigned'
                WHEN md.matched_agent_id IS NULL THEN 'Player references agent_id that does not exist'
                ELSE 'Unknown error'
            END AS error_description
        FROM matched_data md
        WHERE (md.matched_player_id IS NULL) OR (md.player_agent_id IS NULL) OR (md.matched_agent_id IS NULL)
        ORDER BY md.game_count DESC, md.game_player_id
    ) AS result;
END;
$$;


ALTER FUNCTION "public"."get_orphaned_game_players"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_players_in_games_not_in_players"() RETURNS TABLE("player_id" character varying, "player_name" character varying, "game_count" bigint, "total_tips" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
        WHERE p.player_id::TEXT = g.player_id
    )
    GROUP BY g.player_id
    ORDER BY COUNT(*) DESC, g.player_id;
END;
$$;


ALTER FUNCTION "public"."get_players_in_games_not_in_players"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_players_not_mapped_to_agents"() RETURNS TABLE("player_id" integer, "player_name" character varying, "agent_id" integer, "error_description" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.player_id::INTEGER AS player_id,
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
$$;


ALTER FUNCTION "public"."get_players_not_mapped_to_agents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_players_with_invalid_agents"() RETURNS TABLE("player_id" integer, "player_name" character varying, "agent_id" integer, "agent_name" character varying, "error_type" character varying, "error_description" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.player_id::INTEGER,
        p.player_name::VARCHAR(255),
        p.agent_id::INTEGER,
        COALESCE(a.agent_name, 'MISSING')::VARCHAR(255) AS agent_name,
        CASE 
            WHEN p.agent_id IS NULL THEN 'MISSING_AGENT_ID'
            WHEN a.agent_id IS NULL THEN 'INVALID_AGENT_ID'
            ELSE 'UNKNOWN'
        END::VARCHAR(255) AS error_type,
        CASE 
            WHEN p.agent_id IS NULL THEN 'Player has no agent_id assigned'
            WHEN a.agent_id IS NULL THEN 'Player references agent_id that does not exist in agents table'
            ELSE 'Unknown error'
        END::TEXT AS error_description
    FROM players p
    LEFT JOIN agents a ON p.agent_id = a.agent_id
    WHERE p.agent_id IS NULL OR a.agent_id IS NULL
    ORDER BY p.player_id;
END;
$$;


ALTER FUNCTION "public"."get_players_with_invalid_agents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_players_without_real_names"() RETURNS TABLE("player_id" character varying, "player_name" character varying, "agent_id" integer, "agent_name" character varying, "game_count" bigint, "error_type" character varying, "error_description" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH players_with_games AS (
        SELECT DISTINCT
            g.player_id,
            p.player_name,
            p.agent_id AS player_agent_id,
            a.agent_name,
            COUNT(g.*)::BIGINT AS game_count
        FROM games g
        LEFT JOIN players p ON g.player_id = p.player_id::TEXT
        LEFT JOIN agents a ON p.agent_id = a.agent_id
        WHERE p.agent_id IS NOT NULL
        GROUP BY g.player_id, p.player_name, p.agent_id, a.agent_name
    )
    SELECT 
        pwg.player_id::VARCHAR(255),
        pwg.player_name::VARCHAR(255),
        pwg.player_agent_id::INTEGER AS agent_id,
        pwg.agent_name::VARCHAR(255),
        pwg.game_count::BIGINT,
        'MISSING_REAL_NAME'::VARCHAR(255) AS error_type,
        'Player has games but no real_name_mapping entry'::TEXT AS error_description
    FROM players_with_games pwg
    LEFT JOIN real_name_mapping rnm ON rnm.player_id = pwg.player_id AND rnm.agent_id = pwg.player_agent_id
    WHERE rnm.id IS NULL
    ORDER BY pwg.player_agent_id, pwg.player_id;
END;
$$;


ALTER FUNCTION "public"."get_players_without_real_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_weekly_credit_adjustments"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE players
    SET weekly_credit_adjustment = 0,
        updated_at = NOW()
    WHERE weekly_credit_adjustment != 0;
END;
$$;


ALTER FUNCTION "public"."reset_weekly_credit_adjustments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_deal_percent_rules_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Example: set updated_at on update
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_deal_percent_rules_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_ingestor_state_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_email_ingestor_state_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_deal_percent_rules" (
    "id" integer NOT NULL,
    "agent_id" integer NOT NULL,
    "threshold" numeric(10,2) NOT NULL,
    "deal_percent" numeric(10,3) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_deal_percent_rules_deal_percent_check" CHECK ((("deal_percent" >= (0)::numeric) AND ("deal_percent" <= (1)::numeric)))
);


ALTER TABLE "public"."agent_deal_percent_rules" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."agent_deal_percent_rules_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."agent_deal_percent_rules_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."agent_deal_percent_rules_id_seq" OWNED BY "public"."agent_deal_percent_rules"."id";



CREATE TABLE IF NOT EXISTS "public"."agent_telegram_mapping" (
    "id" integer NOT NULL,
    "agent_id" integer NOT NULL,
    "chat_id" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_telegram_mapping" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."agent_telegram_mapping_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."agent_telegram_mapping_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."agent_telegram_mapping_id_seq" OWNED BY "public"."agent_telegram_mapping"."id";



CREATE TABLE IF NOT EXISTS "public"."agents" (
    "agent_id" integer NOT NULL,
    "agent_name" character varying(255) NOT NULL,
    "deal_percent" numeric(10,3) NOT NULL,
    "comm_channel" character varying(255),
    "notes" "text",
    "payment_methods" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."agents_agent_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."agents_agent_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."agents_agent_id_seq" OWNED BY "public"."agents"."agent_id";



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" integer NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "user_email" character varying(255),
    "operation_type" character varying(50) NOT NULL,
    "table_name" character varying(100) NOT NULL,
    "record_id" character varying(255),
    "operation_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."email_ingestor_state" (
    "id" integer DEFAULT 1 NOT NULL,
    "last_run_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "single_row" CHECK (("id" = 1))
);


ALTER TABLE "public"."email_ingestor_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."games" (
    "rank" integer NOT NULL,
    "game_code" character varying(255) NOT NULL,
    "club_code" character varying(255) NOT NULL,
    "player_id" character varying(255) NOT NULL,
    "player_name" character varying(255) NOT NULL,
    "date_started" timestamp with time zone NOT NULL,
    "date_ended" timestamp with time zone NOT NULL,
    "game_type" character varying(255) NOT NULL,
    "big_blind" numeric(10,2) NOT NULL,
    "profit" numeric(10,2) NOT NULL,
    "tips" numeric(10,2) NOT NULL,
    "buy_in" numeric(10,2) NOT NULL,
    "total_tips" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hands" integer
);


ALTER TABLE "public"."games" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."players" (
    "player_id" "text" NOT NULL,
    "player_name" character varying(255) NOT NULL,
    "agent_id" integer,
    "credit_limit" numeric(10,2),
    "notes" "text",
    "comm_channel" character varying(255),
    "payment_methods" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_blocked" boolean DEFAULT false NOT NULL,
    "weekly_credit_adjustment" real DEFAULT '0'::real NOT NULL
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."players_player_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."players_player_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."players_player_id_seq" OWNED BY "public"."players"."player_id";



CREATE TABLE IF NOT EXISTS "public"."real_name_mapping" (
    "id" integer NOT NULL,
    "player_id" character varying(255) NOT NULL,
    "agent_id" integer NOT NULL,
    "real_name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."real_name_mapping" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."real_name_mapping_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."real_name_mapping_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."real_name_mapping_id_seq" OWNED BY "public"."real_name_mapping"."id";



CREATE TABLE IF NOT EXISTS "public"."uploaded_csvs" (
    "id" integer NOT NULL,
    "csv_hash" character varying(64) NOT NULL,
    "filename" character varying(255) NOT NULL,
    "row_count" integer NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."uploaded_csvs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."uploaded_csvs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."uploaded_csvs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."uploaded_csvs_id_seq" OWNED BY "public"."uploaded_csvs"."id";



CREATE TABLE IF NOT EXISTS "public"."user_usernames" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "username" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_usernames" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_usernames_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_usernames_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_usernames_id_seq" OWNED BY "public"."user_usernames"."id";



ALTER TABLE ONLY "public"."agent_deal_percent_rules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."agent_deal_percent_rules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agent_telegram_mapping" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."agent_telegram_mapping_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agents" ALTER COLUMN "agent_id" SET DEFAULT "nextval"('"public"."agents_agent_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."real_name_mapping" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."real_name_mapping_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."uploaded_csvs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."uploaded_csvs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_usernames" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_usernames_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agent_deal_percent_rules"
    ADD CONSTRAINT "agent_deal_percent_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_telegram_mapping"
    ADD CONSTRAINT "agent_telegram_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("agent_id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_ingestor_state"
    ADD CONSTRAINT "email_ingestor_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."games"
    ADD CONSTRAINT "games_pkey" PRIMARY KEY ("game_code", "date_started", "date_ended", "player_id", "profit", "tips", "total_tips");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("player_id");



ALTER TABLE ONLY "public"."real_name_mapping"
    ADD CONSTRAINT "real_name_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_deal_percent_rules"
    ADD CONSTRAINT "unique_agent_player_threshold" UNIQUE ("agent_id", "threshold");



ALTER TABLE ONLY "public"."agent_telegram_mapping"
    ADD CONSTRAINT "unique_agent_telegram_mapping" UNIQUE ("agent_id");



ALTER TABLE ONLY "public"."real_name_mapping"
    ADD CONSTRAINT "unique_player_agent_real_name" UNIQUE ("player_id", "agent_id", "real_name");



ALTER TABLE ONLY "public"."uploaded_csvs"
    ADD CONSTRAINT "uploaded_csvs_csv_hash_key" UNIQUE ("csv_hash");



ALTER TABLE ONLY "public"."uploaded_csvs"
    ADD CONSTRAINT "uploaded_csvs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_usernames"
    ADD CONSTRAINT "user_usernames_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_usernames"
    ADD CONSTRAINT "user_usernames_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_usernames"
    ADD CONSTRAINT "user_usernames_username_key" UNIQUE ("username");



CREATE INDEX "idx_agent_telegram_mapping_agent_id" ON "public"."agent_telegram_mapping" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_telegram_mapping_chat_id" ON "public"."agent_telegram_mapping" USING "btree" ("chat_id");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_operation_type" ON "public"."audit_logs" USING "btree" ("operation_type");



CREATE INDEX "idx_audit_logs_record_id" ON "public"."audit_logs" USING "btree" ("record_id");



CREATE INDEX "idx_audit_logs_table_name" ON "public"."audit_logs" USING "btree" ("table_name");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_deal_percent_rules_agent_id" ON "public"."agent_deal_percent_rules" USING "btree" ("agent_id");



CREATE INDEX "idx_deal_percent_rules_agent_player" ON "public"."agent_deal_percent_rules" USING "btree" ("agent_id");



CREATE INDEX "idx_deal_percent_rules_threshold" ON "public"."agent_deal_percent_rules" USING "btree" ("agent_id", "threshold" DESC);



CREATE INDEX "idx_games_club_code" ON "public"."games" USING "btree" ("club_code");



CREATE INDEX "idx_games_date_ended" ON "public"."games" USING "btree" ("date_ended");



CREATE INDEX "idx_games_date_range" ON "public"."games" USING "btree" ("date_started", "date_ended");



CREATE INDEX "idx_games_date_started" ON "public"."games" USING "btree" ("date_started");



CREATE INDEX "idx_games_game_code" ON "public"."games" USING "btree" ("game_code");



CREATE INDEX "idx_games_player_id" ON "public"."games" USING "btree" ("player_id");



CREATE INDEX "idx_players_agent_id" ON "public"."players" USING "btree" ("agent_id");



CREATE INDEX "idx_real_name_mapping_agent_id" ON "public"."real_name_mapping" USING "btree" ("agent_id");



CREATE INDEX "idx_real_name_mapping_player_agent" ON "public"."real_name_mapping" USING "btree" ("player_id", "agent_id");



CREATE INDEX "idx_real_name_mapping_player_id" ON "public"."real_name_mapping" USING "btree" ("player_id");



CREATE INDEX "idx_real_name_mapping_real_name" ON "public"."real_name_mapping" USING "btree" ("real_name");



CREATE INDEX "idx_uploaded_csvs_hash" ON "public"."uploaded_csvs" USING "btree" ("csv_hash");



CREATE INDEX "idx_user_usernames_user_id" ON "public"."user_usernames" USING "btree" ("user_id");



CREATE INDEX "idx_user_usernames_username" ON "public"."user_usernames" USING "btree" ("username");



CREATE OR REPLACE TRIGGER "update_agent_telegram_mapping_updated_at" BEFORE UPDATE ON "public"."agent_telegram_mapping" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agents_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_deal_percent_rules_updated_at" BEFORE UPDATE ON "public"."agent_deal_percent_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_email_ingestor_state_updated_at" BEFORE UPDATE ON "public"."email_ingestor_state" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_ingestor_state_updated_at"();



CREATE OR REPLACE TRIGGER "update_players_updated_at" BEFORE UPDATE ON "public"."players" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_real_name_mapping_updated_at" BEFORE UPDATE ON "public"."real_name_mapping" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agent_deal_percent_rules"
    ADD CONSTRAINT "agent_deal_percent_rules_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("agent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_telegram_mapping"
    ADD CONSTRAINT "agent_telegram_mapping_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("agent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("agent_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."real_name_mapping"
    ADD CONSTRAINT "real_name_mapping_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("agent_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_usernames"
    ADD CONSTRAINT "user_usernames_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."get_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agents_not_mapped_to_deal_rules"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_agents_not_mapped_to_deal_rules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agents_not_mapped_to_deal_rules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_agents_without_deal_rules"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_agents_without_deal_rules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agents_without_deal_rules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_player_id" integer, "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_player_id" integer, "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_deal_percent"("p_agent_id" integer, "p_player_id" integer, "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_detailed_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_detailed_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_detailed_agent_report"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_detailed_agent_report_by_real_name"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_detailed_agent_report_by_real_name"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_detailed_agent_report_by_real_name"("start_date_param" timestamp with time zone, "end_date_param" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_email_by_username"("username_param" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."get_email_by_username"("username_param" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_email_by_username"("username_param" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_orphaned_game_players"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_orphaned_game_players"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_orphaned_game_players"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_players_in_games_not_in_players"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_players_in_games_not_in_players"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_players_in_games_not_in_players"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_players_not_mapped_to_agents"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_players_not_mapped_to_agents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_players_not_mapped_to_agents"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_players_with_invalid_agents"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_players_with_invalid_agents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_players_with_invalid_agents"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_players_without_real_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_players_without_real_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_players_without_real_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_weekly_credit_adjustments"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_weekly_credit_adjustments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_weekly_credit_adjustments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_deal_percent_rules_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_deal_percent_rules_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_deal_percent_rules_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_ingestor_state_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_ingestor_state_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_ingestor_state_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."agent_deal_percent_rules" TO "anon";
GRANT ALL ON TABLE "public"."agent_deal_percent_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_deal_percent_rules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."agent_deal_percent_rules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."agent_deal_percent_rules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."agent_deal_percent_rules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."agent_telegram_mapping" TO "anon";
GRANT ALL ON TABLE "public"."agent_telegram_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_telegram_mapping" TO "service_role";



GRANT ALL ON SEQUENCE "public"."agent_telegram_mapping_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."agent_telegram_mapping_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."agent_telegram_mapping_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON SEQUENCE "public"."agents_agent_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."agents_agent_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."agents_agent_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."email_ingestor_state" TO "anon";
GRANT ALL ON TABLE "public"."email_ingestor_state" TO "authenticated";
GRANT ALL ON TABLE "public"."email_ingestor_state" TO "service_role";



GRANT ALL ON TABLE "public"."games" TO "anon";
GRANT ALL ON TABLE "public"."games" TO "authenticated";
GRANT ALL ON TABLE "public"."games" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON SEQUENCE "public"."players_player_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."players_player_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."players_player_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."real_name_mapping" TO "anon";
GRANT ALL ON TABLE "public"."real_name_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."real_name_mapping" TO "service_role";



GRANT ALL ON SEQUENCE "public"."real_name_mapping_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."real_name_mapping_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."real_name_mapping_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."uploaded_csvs" TO "anon";
GRANT ALL ON TABLE "public"."uploaded_csvs" TO "authenticated";
GRANT ALL ON TABLE "public"."uploaded_csvs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."uploaded_csvs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."uploaded_csvs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."uploaded_csvs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_usernames" TO "anon";
GRANT ALL ON TABLE "public"."user_usernames" TO "authenticated";
GRANT ALL ON TABLE "public"."user_usernames" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_usernames_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_usernames_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_usernames_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































