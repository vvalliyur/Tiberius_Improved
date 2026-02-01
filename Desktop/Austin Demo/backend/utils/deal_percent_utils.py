"""
Utilities for calculating deal_percent based on rules table.

This module provides functions to get the applicable deal_percent for a given
agent, player, and amount based on the agent_deal_percent_rules table.
"""

from typing import Optional
from supabase.client import Client

TABLE_DEAL_PERCENT_RULES = 'agent_deal_percent_rules'
TABLE_AGENTS = 'agents'


def get_deal_percent_for_amount(
    supabase: Client,
    agent_id: int,
    player_id: Optional[int],
    amount: float,
    rules_cache: Optional[dict] = None
) -> float:
    """
    Get the applicable deal_percent for a given agent, player, and amount.
    
    Priority:
    1. Player-specific rules (player_id matches)
    2. Agent-specific rules (player_id is NULL)
    3. Default agent deal_percent
    
    Args:
        supabase: Supabase client
        agent_id: Agent ID
        player_id: Player ID (can be None)
        amount: Amount (tips) to determine which threshold applies
        rules_cache: Optional cache of rules to avoid repeated queries
    
    Returns:
        The applicable deal_percent (0-1)
    """
    # Use cache if provided, otherwise fetch rules
    if rules_cache is None:
        rules_cache = _fetch_rules_cache(supabase)
    
    # Build cache key
    agent_key = f"agent_{agent_id}"
    player_key = f"player_{player_id}" if player_id is not None else None
    
    # First, try player-specific rules
    if player_key and player_key in rules_cache.get(agent_key, {}):
        player_rules = rules_cache[agent_key][player_key]
        deal_percent = _find_applicable_rule(player_rules, amount)
        if deal_percent is not None:
            return deal_percent
    
    # Then try agent-specific rules
    if agent_key in rules_cache:
        agent_rules = rules_cache[agent_key].get('agent_rules', [])
        deal_percent = _find_applicable_rule(agent_rules, amount)
        if deal_percent is not None:
            return deal_percent
    
    # Fall back to default agent deal_percent
    default_key = f"default_{agent_id}"
    if default_key in rules_cache:
        return rules_cache[default_key]
    
    # If no default found, return 0
    return 0.0


def _find_applicable_rule(rules: list[dict], amount: float) -> Optional[float]:
    """
    Find the rule with the highest threshold where amount >= threshold.
    
    Rule applies when tips >= threshold.
    
    Args:
        rules: List of rule dictionaries with 'threshold' and 'deal_percent'
        amount: Amount (tips) to match against
    
    Returns:
        The deal_percent from the applicable rule, or None
    """
    # Rule applies when tips >= threshold
    applicable_rules = [r for r in rules if amount >= r['threshold']]
    if not applicable_rules:
        return None
    
    # Sort by threshold descending and return the highest
    applicable_rules.sort(key=lambda x: x['threshold'], reverse=True)
    return applicable_rules[0]['deal_percent']


def _fetch_rules_cache(supabase: Client) -> dict:
    """
    Fetch all rules and agent defaults, organized for fast lookup.
    
    Returns:
        Dictionary structure:
        {
            'agent_1': {
                'player_123': [{'threshold': 1000, 'deal_percent': 0.6}, ...],
                'agent_rules': [{'threshold': 500, 'deal_percent': 0.5}, ...]
            },
            'default_1': 0.4,  # default deal_percent from agents table
            ...
        }
    """
    cache = {}
    
    # Fetch all rules
    try:
        rules_response = supabase.table(TABLE_DEAL_PERCENT_RULES).select('*').execute()
        rules = rules_response.data if rules_response.data else []
        
        for rule in rules:
            agent_id = rule['agent_id']
            player_id = rule.get('player_id')
            agent_key = f"agent_{agent_id}"
            
            if agent_key not in cache:
                cache[agent_key] = {}
            
            if player_id is not None:
                player_key = f"player_{player_id}"
                if player_key not in cache[agent_key]:
                    cache[agent_key][player_key] = []
                cache[agent_key][player_key].append({
                    'threshold': float(rule['threshold']),
                    'deal_percent': float(rule['deal_percent'])
                })
            else:
                # Agent-specific rule
                if 'agent_rules' not in cache[agent_key]:
                    cache[agent_key]['agent_rules'] = []
                cache[agent_key]['agent_rules'].append({
                    'threshold': float(rule['threshold']),
                    'deal_percent': float(rule['deal_percent'])
                })
    except Exception as e:
        print(f"Warning: Could not fetch deal_percent rules: {e}")
    
    # Fetch default deal_percent from agents table
    try:
        agents_response = supabase.table(TABLE_AGENTS).select('agent_id, deal_percent').execute()
        if agents_response.data:
            for agent in agents_response.data:
                agent_id = agent['agent_id']
                default_key = f"default_{agent_id}"
                cache[default_key] = float(agent['deal_percent'])
    except Exception as e:
        print(f"Warning: Could not fetch agent defaults: {e}")
    
    return cache


def calculate_deal_percent_column(
    supabase: Client,
    games_df,
    players_df
) -> list[float]:
    """
    Calculate deal_percent for each game row based on rules.
    
    This function processes a games dataframe and returns a list of deal_percent
    values that can be added as a column. It calculates per-game deal_percent
    based on each game's tips amount.
    
    Args:
        supabase: Supabase client
        games_df: Polars DataFrame with games data (must have 'player_id', 'tips')
        players_df: Polars DataFrame with players data (must have 'player_id', 'agent_id')
    
    Returns:
        List of deal_percent values (one per row in games_df)
    """
    import polars as pl
    
    # Fetch rules cache once
    rules_cache = _fetch_rules_cache(supabase)
    
    # Join games with players to get agent_id
    games_with_players = games_df.join(
        players_df.select([
            pl.col('player_id').cast(pl.Utf8).alias('player_id'),
            pl.col('agent_id').cast(pl.Int64).alias('agent_id')
        ]),
        on='player_id',
        how='left'
    )
    
    # Calculate deal_percent for each row
    deal_percents = []
    for row in games_with_players.iter_rows(named=True):
        agent_id = row.get('agent_id')
        player_id_str = row.get('player_id')
        tips = float(row.get('tips', 0))
        
        if agent_id is None:
            deal_percents.append(0.0)
            continue
        
        # Convert player_id from string to int if needed
        player_id_int = None
        if player_id_str:
            try:
                player_id_int = int(player_id_str)
            except (ValueError, TypeError):
                pass
        
        deal_percent = get_deal_percent_for_amount(
            supabase,
            int(agent_id),
            player_id_int,
            tips,
            rules_cache
        )
        deal_percents.append(deal_percent)
    
    return deal_percents

