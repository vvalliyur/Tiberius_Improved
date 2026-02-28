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
    """Get applicable deal_percent. Priority: player rules > agent rules > default."""
    if rules_cache is None:
        rules_cache = _fetch_rules_cache(supabase)
    
    agent_key = f"agent_{agent_id}"
    player_key = f"player_{player_id}" if player_id is not None else None
    
    if player_key and player_key in rules_cache.get(agent_key, {}):
        player_rules = rules_cache[agent_key][player_key]
        deal_percent = _find_applicable_rule(player_rules, amount)
        if deal_percent is not None:
            return deal_percent
    
    if agent_key in rules_cache:
        agent_rules = rules_cache[agent_key].get('agent_rules', [])
        deal_percent = _find_applicable_rule(agent_rules, amount)
        if deal_percent is not None:
            return deal_percent
    
    default_key = f"default_{agent_id}"
    if default_key in rules_cache:
        return rules_cache[default_key]
    
    return 0.0


def _find_applicable_rule(rules: list[dict], amount: float) -> Optional[float]:
    """Find the rule with the highest threshold where amount >= threshold."""
    applicable_rules = [r for r in rules if amount >= r['threshold']]
    if not applicable_rules:
        return None
    
    applicable_rules.sort(key=lambda x: x['threshold'], reverse=True)
    return applicable_rules[0]['deal_percent']


def _fetch_rules_cache(supabase: Client) -> dict:
    """Fetch all rules and agent defaults, organized for fast lookup."""
    cache = {}

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
                if 'agent_rules' not in cache[agent_key]:
                    cache[agent_key]['agent_rules'] = []
                cache[agent_key]['agent_rules'].append({
                    'threshold': float(rule['threshold']),
                    'deal_percent': float(rule['deal_percent'])
                })
    except Exception as e:
        pass
    
    try:
        agents_response = supabase.table(TABLE_AGENTS).select('agent_id, deal_percent').execute()
        if agents_response.data:
            for agent in agents_response.data:
                agent_id = agent['agent_id']
                default_key = f"default_{agent_id}"
                cache[default_key] = float(agent['deal_percent'])
    except Exception as e:
        pass
    
    return cache


def calculate_deal_percent_column(
    supabase: Client,
    games_df,
    players_df
) -> list[float]:
    """Calculate deal_percent for each game row based on rules."""
    import polars as pl

    rules_cache = _fetch_rules_cache(supabase)

    games_with_players = games_df.join(
        players_df.select([
            pl.col('player_id').cast(pl.Utf8).alias('player_id'),
            pl.col('agent_id').cast(pl.Int64).alias('agent_id')
        ]),
        on='player_id',
        how='left'
    )
    
    deal_percents = []
    for row in games_with_players.iter_rows(named=True):
        agent_id = row.get('agent_id')
        player_id_str = row.get('player_id')
        tips = float(row.get('tips', 0))
        
        if agent_id is None:
            deal_percents.append(0.0)
            continue
        
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

