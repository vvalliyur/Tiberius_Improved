import sys
from pathlib import Path

backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI, HTTPException, Query, Path, UploadFile, File, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from datetime import date, datetime, timedelta
import pytz
from supabase.client import create_client, Client
import os
from dotenv import load_dotenv
import polars as pl
from data.schemas.df_schemas import User, GameDataS, AgentS, PlayerS
from utils.auth_utils import create_get_current_user
from utils.datetime_utils import resolve_date_range, get_last_thursday_12am_texas
from data.schemas.web_schemas import UpsertAgentRequest, UpsertPlayerRequest
from data.csv_upload import upload_csv_to_games
from utils.audit_log import log_operation
import tempfile

TABLE_GAMES = 'games'
TABLE_AGENTS = 'agents'
TABLE_PLAYERS = 'players'

load_dotenv()

app = FastAPI(title='Poker Accounting System', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET')

if not SUPABASE_URL or not SUPABASE_KEY:
    error_msg = (
        'SUPABASE_URL and SUPABASE_KEY must be set in environment variables.\n'
        'Please create a .env file in the backend directory with:\n'
        '  SUPABASE_URL=https://your-project.supabase.co\n'
        '  SUPABASE_KEY=your-anon-key\n'
        '  SUPABASE_JWT_SECRET=your-jwt-secret (optional for HS256 tokens)'
    )
    raise ValueError(error_msg)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    error_msg = (
        f'Failed to create Supabase client.\n'
        f'Error: {str(e)}\n'
        f'Please check:\n'
        f'  1. SUPABASE_URL is correct: {SUPABASE_URL[:50]}...\n'
        f'  2. SUPABASE_KEY is correct\n'
        f'  3. Your network connection is working\n'
        f'  4. The Supabase project is accessible'
    )
    raise ValueError(error_msg)

security = HTTPBearer()
get_current_user = create_get_current_user(security, SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET)


def response_to_lazyframe(response_data: list) -> pl.LazyFrame:
    if not response_data:
        return pl.LazyFrame()
    return pl.DataFrame(response_data).lazy()


@app.get('/')
async def root():
    return {'message': 'Tiberius Accounting System API'}


@app.get('/health')
async def health_check():
    try:
        supabase.table('agents').select('agent_id').limit(1).execute()
        return {
            'status': 'healthy',
            'supabase': 'connected',
            'supabase_url': SUPABASE_URL[:50] + '...' if SUPABASE_URL else 'not configured'
        }
    except Exception as e:
        return {
            'status': 'degraded',
            'supabase': 'disconnected',
            'error': str(e)[:100] if str(e) else 'Unknown error',
            'message': 'Backend is running but Supabase connection failed. Check your SUPABASE_URL and SUPABASE_KEY.'
        }


@app.post('/auth/lookup-email')
async def lookup_email_by_username(username: str = Query(..., description='Username to look up')):
    """Look up email address by username. No authentication required for this endpoint."""
    try:
        response = supabase.rpc('get_email_by_username', {'username_param': username}).execute()
        # RPC returns a list of rows, each row is a dict with 'email' key
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail='Username not found')
        # The RPC function returns rows with 'email' field
        email_row = response.data[0] if isinstance(response.data[0], dict) else None
        if not email_row:
            raise HTTPException(status_code=404, detail='Email not found for username')
        email = email_row.get('email') if isinstance(email_row, dict) else None
        if not email:
            raise HTTPException(status_code=404, detail='Email not found for username')
        return {'email': email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to look up email: {str(e)}')


@app.post('/auth/create-username')
async def create_username(username_data: dict = Body(...), current_user: User = Depends(get_current_user)):
    """Create username mapping for the current user. Requires authentication."""
    try:
        username = username_data.get('username')
        if not username:
            raise HTTPException(status_code=400, detail='Username is required')
        
        # Check if username already exists
        existing = supabase.table('user_usernames').select('*').eq('username', username).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail='Username already taken')
        
        # Check if user already has a username
        existing_user = supabase.table('user_usernames').select('*').eq('user_id', current_user.id).execute()
        if existing_user.data:
            # Update existing username
            supabase.table('user_usernames').update({'username': username}).eq('user_id', current_user.id).execute()
        else:
            # Create new username mapping
            supabase.table('user_usernames').insert({
                'user_id': current_user.id,
                'username': username
            }).execute()
        
        return {'message': 'Username created successfully', 'username': username}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to create username: {str(e)}')


@app.get('/get_data')
async def get_data(
    start_date: date | None = Query(None, description='Start date for the query'),
    end_date: date | None = Query(None, description='End date for the query'),
    club_code: str | None = Query(None, description='Club code for the query'),
    lookback_days: int | None = Query(None, description='Optional lookback period in days'),
    current_user: User = Depends(get_current_user),
):
    try:
        resolved_start, resolved_end = resolve_date_range(lookback_days, start_date, end_date)
        query = supabase.table(TABLE_GAMES).select('*').gte(GameDataS.date_started, resolved_start.isoformat()).lte(GameDataS.date_ended, resolved_end.isoformat())
        if club_code:
            query = query.eq(GameDataS.club_code, club_code)
        
        response = query.execute()
        return {'data': response.data, 'count': len(response.data)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_aggregated_data')
async def get_aggregated_data(
    start_date: date | None = Query(None, description="Start date for the query"),
    end_date: date | None = Query(None, description="End date for the query"),
    lookback_days: int | None = Query(None, description="Optional lookback period in days"),
    club_code: str | None = Query(None, description="Club code for the query"),
    current_user: User = Depends(get_current_user),
):
    try:
        resolved_start, resolved_end = resolve_date_range(lookback_days, start_date, end_date)
        
        response = supabase.table(TABLE_GAMES).select('*').gte('date_started', resolved_start.isoformat()).lte('date_ended', resolved_end.isoformat()).execute()
        
        df = response_to_lazyframe(response.data)
        
        aggregated = (
            df
            .group_by('player_id', 'player_name')
            .agg([
                pl.sum('profit').alias('total_profit'),
                pl.sum('tips').alias('total_tips'),
                pl.count().alias('game_count')
            ])
            .select([
                'player_id',
                'player_name',
                'total_profit',
                'total_tips',
                'game_count'
            ])
            .collect()
        )
        
        result_data = aggregated.to_dicts()
        return {"data": result_data, "count": len(result_data)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_agents')
async def get_agents(current_user: User = Depends(get_current_user)):
    try:
        response = supabase.table(TABLE_AGENTS).select('*').execute()
        return {'data': response.data, 'count': len(response.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_players')
async def get_players(current_user: User = Depends(get_current_user)):
    try:
        players_response = supabase.table(TABLE_PLAYERS).select('*').execute()
        agents_response = supabase.table(TABLE_AGENTS).select('agent_id, agent_name').execute()
        agents_map = {agent['agent_id']: agent['agent_name'] for agent in agents_response.data}
        
        players_data = []
        for player in players_response.data:
            player_dict = dict(player)
            agent_id = player.get('agent_id')
            player_dict['agent_name'] = agents_map.get(agent_id) if agent_id else None
            players_data.append(player_dict)
        
        return {'data': players_data, 'count': len(players_data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_agent_report')
async def get_agent_report(
    start_date: date | None = Query(None, description="Start date for the query"),
    end_date: date | None = Query(None, description="End date for the query"),
    lookback_days: int | None = Query(None, description="Optional lookback period in days"),
    current_user: User = Depends(get_current_user),
):
    try:
        resolved_start, resolved_end = resolve_date_range(lookback_days, start_date, end_date)
        
        response = supabase.rpc(
            'get_agent_report',
            {
                'start_date_param': resolved_start.isoformat(),
                'end_date_param': resolved_end.isoformat()
            }
        ).execute()
        
        return {'data': response.data, 'count': len(response.data)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_detailed_agent_report')
async def get_detailed_agent_report(
    start_date: date | None = Query(None, description="Start date for the query"),
    end_date: date | None = Query(None, description="End date for the query"),
    lookback_days: int | None = Query(None, description="Optional lookback period in days"),
    group_by: str = Query('player_id', description="Group by 'player_id' or 'real_name'"),
    current_user: User = Depends(get_current_user),
):
    try:
        resolved_start, resolved_end = resolve_date_range(lookback_days, start_date, end_date)
        
        # Choose function based on group_by parameter
        if group_by == 'real_name':
            response = supabase.rpc(
                'get_detailed_agent_report_by_real_name',
                {
                    'start_date_param': resolved_start.isoformat(),
                    'end_date_param': resolved_end.isoformat()
                }
            ).execute()
        else:
            response = supabase.rpc(
                'get_detailed_agent_report',
                {
                    'start_date_param': resolved_start.isoformat(),
                    'end_date_param': resolved_end.isoformat()
                }
            ).execute()
        
        return {'data': response.data, 'count': len(response.data)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_agent_reports')
async def get_agent_reports(
    start_date: date | None = Query(None, description="Start date for the query"),
    end_date: date | None = Query(None, description="End date for the query"),
    lookback_days: int | None = Query(None, description="Optional lookback period in days"),
    group_by: str = Query('player_id', description="Group by 'player_id' or 'real_name'"),
    current_user: User = Depends(get_current_user),
):
    """Combined endpoint that returns both aggregated and detailed agent reports in one call."""
    try:
        resolved_start, resolved_end = resolve_date_range(lookback_days, start_date, end_date)
        
        # Aggregated report is always the same (grouped by agent)
        aggregated_response = supabase.rpc(
            'get_agent_report',
            {
                'start_date_param': resolved_start.isoformat(),
                'end_date_param': resolved_end.isoformat()
            }
        ).execute()
        
        # Detailed report changes based on group_by parameter
        if group_by == 'real_name':
            detailed_response = supabase.rpc(
                'get_detailed_agent_report_by_real_name',
                {
                    'start_date_param': resolved_start.isoformat(),
                    'end_date_param': resolved_end.isoformat()
                }
            ).execute()
        else:
            # Default to player_id grouping
            detailed_response = supabase.rpc(
                'get_detailed_agent_report',
                {
                    'start_date_param': resolved_start.isoformat(),
                    'end_date_param': resolved_end.isoformat()
                }
            ).execute()
        
        return {
            'aggregated': {
                'data': aggregated_response.data,
                'count': len(aggregated_response.data)
            },
            'detailed': {
                'data': detailed_response.data,
                'count': len(detailed_response.data)
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_data_errors')
async def get_data_errors(
    current_user: User = Depends(get_current_user),
):
    """Get all data quality errors:
    1. Player IDs in games table that are not in players table
    2. Players in players table that are not mapped to agents
    3. Agents that are not mapped to deal rules
    """
    try:
        # Get all error types
        players_in_games_not_in_players_response = supabase.rpc('get_players_in_games_not_in_players', {}).execute()
        players_not_mapped_to_agents_response = supabase.rpc('get_players_not_mapped_to_agents', {}).execute()
        agents_not_mapped_to_deal_rules_response = supabase.rpc('get_agents_not_mapped_to_deal_rules', {}).execute()
        
        return {
            'players_in_games_not_in_players': {
                'data': players_in_games_not_in_players_response.data or [],
                'count': len(players_in_games_not_in_players_response.data or [])
            },
            'players_not_mapped_to_agents': {
                'data': players_not_mapped_to_agents_response.data or [],
                'count': len(players_not_mapped_to_agents_response.data or [])
            },
            'agents_not_mapped_to_deal_rules': {
                'data': agents_not_mapped_to_deal_rules_response.data or [],
                'count': len(agents_not_mapped_to_deal_rules_response.data or [])
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_player_history')
async def get_player_history(
    start_date: date | None = Query(None, description="Start date for the query"),
    end_date: date | None = Query(None, description="End date for the query"),
    player_ids: str = Query(..., description='Comma-separated list of player IDs'),
    lookback_days: int | None = Query(None, description="Optional lookback period in days"),
    current_user: User = Depends(get_current_user),
):
    try:
        player_id_list = [pid.strip() for pid in player_ids.split(',')]
        
        query = supabase.table(TABLE_GAMES).select('*').in_('player_id', player_id_list)
        
        if lookback_days is not None or (start_date is not None and end_date is not None):
            resolved_start, resolved_end = resolve_date_range(lookback_days, start_date, end_date)
            query = query.gte('date_started', resolved_start.isoformat()).lte('date_ended', resolved_end.isoformat())
        
        games_response = query.execute()
        
        if not games_response.data:
            return {
                "aggregated": [],
                "individual_records": [],
                "aggregated_count": 0,
                "individual_count": 0
            }
        
        # Convert to polars dataframes
        games_df = response_to_lazyframe(games_response.data)
        
        # Get all players data (we'll filter/join in Polars)
        players_response = supabase.table(TABLE_PLAYERS).select('player_id, agent_id').execute()
        players_df = None
        agents_df = None
        
        if players_response.data:
            players_df = response_to_lazyframe(players_response.data)
            players_df = players_df.select([
                pl.col('player_id').cast(pl.Utf8).alias('player_id_str'),
                pl.col('agent_id')
            ])
            
            # Get unique agent_ids from players
            agent_ids = response_to_lazyframe(players_response.data).select('agent_id').unique().filter(pl.col('agent_id').is_not_null()).collect().to_series().to_list()
            if agent_ids:
                agents_response = supabase.table(TABLE_AGENTS).select('agent_id, deal_percent').in_('agent_id', agent_ids).execute()
                if agents_response.data:
                    agents_df = response_to_lazyframe(agents_response.data)
        
        if players_df is not None:
            games_with_players = games_df.join(
                players_df,
                left_on='player_id',
                right_on='player_id_str',
                how='left'
            )
        else:
            games_with_players = games_df.with_columns(pl.lit(None).cast(pl.Int64).alias('agent_id'))
        
        if agents_df is not None:
            games_with_agents = games_with_players.join(
                agents_df,
                on='agent_id',
                how='left'
            )
        else:
            # If no agents found, add null deal_percent column
            games_with_agents = games_with_players.with_columns(pl.lit(None).cast(pl.Float64).alias('deal_percent'))
        
        df_with_agent_tips = games_with_agents.with_columns([
            (pl.col('tips') * pl.col('deal_percent').fill_null(0)).alias('agent_tips')
        ])
        
        # Aggregate by player_id
        aggregated = (
            df_with_agent_tips
            .group_by('player_id', 'player_name')
            .agg([
                pl.sum('profit').alias('total_profit'),
                pl.sum('tips').alias('total_tips'),
                pl.sum('agent_tips').alias('agent_tips'),
                pl.sum('hands').alias('total_hands'),
                pl.count().alias('game_count')
            ])
            .with_columns([
                (pl.col('total_tips') - pl.col('agent_tips')).alias('takehome_tips')
            ])
            .with_columns([
                pl.col('agent_tips').round(2),
                pl.col('takehome_tips').round(2)
            ])
            .collect()
        )
        
        aggregated_data = aggregated.to_dicts()
        individual_records = games_response.data
        
        return {
            "aggregated": aggregated_data,
            "individual_records": individual_records,
            "aggregated_count": len(aggregated_data),
            "individual_count": len(individual_records)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/agents/upsert')
async def upsert_agent(agent_data: UpsertAgentRequest, current_user: User = Depends(get_current_user)):
    try:
        data = {
            'agent_name': agent_data.agent_name,
            'deal_percent': agent_data.deal_percent,
            'comm_channel': agent_data.comm_channel,
            'notes': agent_data.notes,
            'payment_methods': agent_data.payment_methods
        }
        data = {k: v for k, v in data.items() if v is not None}
        
        if agent_data.agent_id is not None:
            check_response = supabase.table(TABLE_AGENTS).select('*').eq('agent_id', agent_data.agent_id).execute()
            if not check_response.data:
                raise HTTPException(status_code=404, detail=f'Agent with ID {agent_data.agent_id} not found')
            
            response = supabase.table(TABLE_AGENTS).update(data).eq('agent_id', agent_data.agent_id).execute()
            if not response.data:
                raise HTTPException(status_code=500, detail='Failed to update agent')
            
            log_operation(
                supabase=supabase,
                user=current_user,
                operation_type='UPDATE',
                table_name=TABLE_AGENTS,
                record_id=agent_data.agent_id,
                operation_data={'updated_fields': data, 'agent_id': agent_data.agent_id}
            )
            
            return {'data': response.data[0], 'message': 'Agent updated successfully'}
        else:
            response = supabase.table(TABLE_AGENTS).insert(data).execute()
            if not response.data:
                raise HTTPException(status_code=500, detail='Failed to create agent')
            
            created_agent_id = response.data[0].get('agent_id')
            log_operation(
                supabase=supabase,
                user=current_user,
                operation_type='CREATE',
                table_name=TABLE_AGENTS,
                record_id=created_agent_id,
                operation_data={'created_data': response.data[0]}
            )
            
            return {'data': response.data[0], 'message': 'Agent created successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/players/upsert')
async def upsert_player(player_data: UpsertPlayerRequest, current_user: User = Depends(get_current_user)):
    try:
        if player_data.agent_id is not None:
            agent_check = supabase.table(TABLE_AGENTS).select('agent_id').eq('agent_id', player_data.agent_id).execute()
            if not agent_check.data:
                raise HTTPException(status_code=404, detail=f'Agent with ID {player_data.agent_id} not found')
        
        data = {
            'player_name': player_data.player_name,
            'agent_id': player_data.agent_id,
            'credit_limit': player_data.credit_limit,
            'weekly_credit_adjustment': player_data.weekly_credit_adjustment,
            'notes': player_data.notes,
            'comm_channel': player_data.comm_channel,
            'payment_methods': player_data.payment_methods,
            'is_blocked': player_data.is_blocked
        }
        # Keep is_blocked and weekly_credit_adjustment even if False/0, but filter out None values for other fields
        data = {k: v for k, v in data.items() if v is not None or k in ['is_blocked', 'weekly_credit_adjustment']}
        
        if player_data.player_id is not None:
            check_response = supabase.table(TABLE_PLAYERS).select('*').eq('player_id', player_data.player_id).execute()
            if not check_response.data:
                raise HTTPException(status_code=404, detail=f'Player with ID {player_data.player_id} not found')
            
            response = supabase.table(TABLE_PLAYERS).update(data).eq('player_id', player_data.player_id).execute()
            if not response.data:
                raise HTTPException(status_code=500, detail='Failed to update player')
            
            log_operation(
                supabase=supabase,
                user=current_user,
                operation_type='UPDATE',
                table_name=TABLE_PLAYERS,
                record_id=player_data.player_id,
                operation_data={'updated_fields': data, 'player_id': player_data.player_id}
            )
            
            return {'data': response.data[0], 'message': 'Player updated successfully'}
        else:
            response = supabase.table(TABLE_PLAYERS).insert(data).execute()
            if not response.data:
                raise HTTPException(status_code=500, detail='Failed to create player')
            
            created_player_id = response.data[0].get('player_id')
            log_operation(
                supabase=supabase,
                user=current_user,
                operation_type='CREATE',
                table_name=TABLE_PLAYERS,
                record_id=created_player_id,
                operation_data={'created_data': response.data[0]}
            )
            
            return {'data': response.data[0], 'message': 'Player created successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_create_update_history')
async def get_create_update_history(
    start_date: date | None = Query(None, description="Start date for the query"),
    end_date: date | None = Query(None, description="End date for the query"),
    lookback_days: int | None = Query(None, description="Optional lookback period in days"),
    table_name: str | None = Query(None, description='Filter by table name'),
    operation_type: str | None = Query(None, description='Filter by operation type (CREATE, UPDATE)'),
    current_user: User = Depends(get_current_user),
):
    try:
        query = supabase.table('audit_logs').select('*')
        
        if start_date or end_date or lookback_days:
            resolved_start, resolved_end = resolve_date_range(lookback_days, start_date, end_date)
            query = query.gte('created_at', resolved_start.isoformat()).lte('created_at', resolved_end.isoformat())
        
        if table_name:
            query = query.eq('table_name', table_name)
        
        if operation_type:
            query = query.eq('operation_type', operation_type.upper())
        
        response = query.order('created_at', desc=True).execute()
        return {'data': response.data, 'count': len(response.data)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/get_dashboard_data')
async def get_dashboard_data(current_user: User = Depends(get_current_user)):
    """Get dashboard data including tips stats, player aggregates, and agent report"""
    try:
        # Get all games data
        all_games_response = supabase.table(TABLE_GAMES).select('*').execute()
        all_games_df = response_to_lazyframe(all_games_response.data)
        
        # Calculate total tips across all time using lazy frame
        total_tips_all_time = 0.0
        if all_games_response.data:
            total_tips_result = (
                all_games_df
                .select(pl.sum('tips'))
                .collect()
            )
            if total_tips_result.height > 0 and total_tips_result.row(0)[0] is not None:
                total_tips_all_time = float(total_tips_result.row(0)[0])
        
        # Get last Thursday 12am Texas time
        last_thursday_texas = get_last_thursday_12am_texas()
        previous_thursday_texas = last_thursday_texas - timedelta(days=7)
        
        # Convert to UTC for database queries
        last_thursday_utc = last_thursday_texas.astimezone(pytz.UTC)
        previous_thursday_utc = previous_thursday_texas.astimezone(pytz.UTC)
        last_thursday_iso = last_thursday_utc.isoformat()
        previous_thursday_iso = previous_thursday_utc.isoformat()
        
        # Calculate total tips for previous period (previous Thursday to last Thursday) using lazy frame
        previous_period_tips = 0.0
        if all_games_response.data:
            prev_period_result = (
                all_games_df
                .filter(
                    (pl.col('date_started') >= previous_thursday_iso) &
                    (pl.col('date_started') < last_thursday_iso)
                )
                .select(pl.sum('tips'))
                .collect()
            )
            if prev_period_result.height > 0 and prev_period_result.row(0)[0] is not None:
                previous_period_tips = float(prev_period_result.row(0)[0])
        
        # Calculate total tips since last Thursday using lazy frame
        since_last_thursday_tips = 0.0
        games_since_thursday_df = None
        if all_games_response.data:
            # First check if there are any records since last Thursday
            games_since_thursday_df = all_games_df.filter(pl.col('date_started') >= last_thursday_iso)
            since_thursday_result = (
                games_since_thursday_df
                .select(pl.sum('tips'))
                .collect()
            )
            if since_thursday_result.height > 0 and since_thursday_result.row(0)[0] is not None:
                since_last_thursday_tips = float(since_thursday_result.row(0)[0])
            else:
                # No records since last Thursday, set to None to skip processing
                games_since_thursday_df = None
        
        # Get players and agents data
        players_response = supabase.table(TABLE_PLAYERS).select('*').execute()
        agents_response = supabase.table(TABLE_AGENTS).select('agent_id, agent_name, deal_percent').execute()
        
        # Get blocked players using Polars lazy frames
        blocked_players = []
        if players_response.data and agents_response.data:
            players_df = response_to_lazyframe(players_response.data)
            agents_df = response_to_lazyframe(agents_response.data)
            
            # Filter blocked players and join with agents
            blocked_players_df = (
                players_df
                .filter(pl.col('is_blocked') == True)
                .join(
                    agents_df.select([
                        pl.col('agent_id'),
                        pl.col('agent_name')
                    ]),
                    on='agent_id',
                    how='left'
                )
                .select([
                    pl.col('player_id'),
                    pl.col('player_name'),
                    pl.col('agent_id'),
                    pl.col('agent_name'),
                    pl.col('credit_limit'),
                    pl.col('comm_channel'),
                    pl.col('notes')
                ])
                .collect()
            )
            
            # Convert to list of dictionaries
            blocked_players = blocked_players_df.to_dicts()
            # Convert numeric values to proper types (keep player_id as string)
            for item in blocked_players:
                if item.get('credit_limit') is not None:
                    item['credit_limit'] = float(item['credit_limit'])
        
        # Initialize empty results - will be populated only if there are records since last Thursday
        player_aggregates = []
        agent_report = []
        over_credit_limit_players = []
        
        # Get players over credit limit since start of week
        if games_since_thursday_df is not None and players_response.data and agents_response.data:
            players_df = response_to_lazyframe(players_response.data)
            agents_df = response_to_lazyframe(agents_response.data)
            
            # Aggregate games since last Thursday by player (using lazy frame)
            games_agg_period = (
                games_since_thursday_df
                .group_by('player_id')
                .agg([
                    pl.sum('profit').alias('period_profit')
                ])
            )
            
            # Join with players to get credit limit and weekly adjustment
            over_credit_df = (
                games_agg_period
                .join(
                    players_df.select([
                        pl.col('player_id').cast(pl.Utf8).alias('player_id'),
                        pl.col('player_name'),
                        pl.col('agent_id'),
                        pl.col('credit_limit'),
                        pl.col('weekly_credit_adjustment')
                    ]),
                    on='player_id',
                    how='inner'
                )
                .join(
                    agents_df.select([
                        pl.col('agent_id'),
                        pl.col('agent_name')
                    ]),
                    on='agent_id',
                    how='left'
                )
                .with_columns([
                    pl.col('credit_limit').cast(pl.Float64),
                    pl.col('weekly_credit_adjustment').cast(pl.Float64),
                    (pl.col('credit_limit') + pl.col('weekly_credit_adjustment')).alias('adjusted_credit_limit')
                ])
                .filter(
                    pl.col('credit_limit').is_not_null() &
                    (pl.col('period_profit') < -(pl.col('credit_limit') + pl.col('weekly_credit_adjustment')))
                )
                .select([
                    pl.col('player_id'),
                    pl.col('player_name'),
                    pl.col('agent_id'),
                    pl.col('agent_name'),
                    pl.col('credit_limit'),
                    pl.col('weekly_credit_adjustment'),
                    pl.col('adjusted_credit_limit'),
                    pl.col('period_profit')
                ])
                .collect()
            )
            
            # Convert to list of dictionaries
            over_credit_limit_players = over_credit_df.to_dicts()
            # Convert numeric values to proper types (keep player_id as string)
            for item in over_credit_limit_players:
                item['period_profit'] = float(item['period_profit'])
                if item.get('credit_limit') is not None:
                    item['credit_limit'] = float(item['credit_limit'])
                if item.get('weekly_credit_adjustment') is not None:
                    item['weekly_credit_adjustment'] = float(item['weekly_credit_adjustment'])
                if item.get('adjusted_credit_limit') is not None:
                    item['adjusted_credit_limit'] = float(item['adjusted_credit_limit'])
        
        # Only process player aggregates and agent report if there are games since last Thursday
        if games_since_thursday_df is not None and players_response.data and agents_response.data:
            # Create lazy frames for joins
            players_df = response_to_lazyframe(players_response.data)
            agents_df = response_to_lazyframe(agents_response.data)
            
            # Aggregate all-time games by player for credit limit check (using lazy frame)
            games_agg_all_time = (
                all_games_df
                .group_by('player_id')
                .agg([pl.sum('profit').alias('all_time_profit')])
            )
            
            # Aggregate games since last Thursday by player (using lazy frame)
            games_agg_period = (
                games_since_thursday_df
                .group_by('player_id')
                .agg([
                    pl.sum('profit').alias('total_profit'),
                    pl.sum('tips').alias('total_tips'),
                    pl.count().alias('game_count')
                ])
            )
            
            # Join period aggregates with players and agents (using lazy frames)
            player_aggregates_df = (
                games_agg_period
                .join(
                    players_df.select([
                        pl.col('player_id').cast(pl.Utf8).alias('player_id'),
                        pl.col('player_name'),
                        pl.col('agent_id'),
                        pl.col('credit_limit'),
                        pl.col('weekly_credit_adjustment')
                    ]),
                    on='player_id',
                    how='inner'
                )
                .join(
                    agents_df.select([
                        pl.col('agent_id'),
                        pl.col('agent_name'),
                        pl.col('deal_percent')
                    ]),
                    on='agent_id',
                    how='left'
                )
                .join(
                    games_agg_all_time.select([
                        pl.col('player_id'),
                        pl.col('all_time_profit')
                    ]),
                    on='player_id',
                    how='left'
                )
                .with_columns([
                    pl.col('credit_limit').cast(pl.Float64),
                    pl.col('weekly_credit_adjustment').cast(pl.Float64),
                    (pl.col('credit_limit') + pl.col('weekly_credit_adjustment')).alias('adjusted_credit_limit'),
                    pl.when(
                        pl.col('credit_limit').is_not_null() & 
                        (pl.col('all_time_profit') < -(pl.col('credit_limit') + pl.col('weekly_credit_adjustment')))
                    )
                    .then(True)
                    .otherwise(False)
                    .alias('is_below_credit')
                ])
                .select([
                    pl.col('player_id'),
                    pl.col('player_name'),
                    pl.col('agent_id'),
                    pl.col('agent_name'),
                    pl.col('deal_percent'),
                    pl.col('credit_limit'),
                    pl.col('total_profit'),
                    pl.col('total_tips'),
                    pl.col('game_count').cast(pl.Int64),
                    pl.col('is_below_credit')
                ])
                .collect()
            )
            
            # Convert to list of dictionaries
            player_aggregates = player_aggregates_df.to_dicts()
            # Convert numeric values to proper types (keep player_id as string)
            for item in player_aggregates:
                item['total_profit'] = float(item['total_profit'])
                item['total_tips'] = float(item['total_tips'])
                item['game_count'] = int(item['game_count'])
                if item.get('credit_limit') is not None:
                    item['credit_limit'] = float(item['credit_limit'])
                if item.get('deal_percent') is not None:
                    item['deal_percent'] = float(item['deal_percent'])
            
            # Get agent report (aggregated) - only for games since last Thursday
            # Join games with players and agents (using lazy frames)
            games_with_players = (
                games_since_thursday_df
                .join(
                    players_df.select([
                        pl.col('player_id').cast(pl.Utf8).alias('player_id'),
                        pl.col('agent_id')
                    ]),
                    on='player_id',
                    how='inner'
                )
            )
            
            games_with_agents = (
                games_with_players
                .join(
                    agents_df.select(['agent_id', 'deal_percent']),
                    on='agent_id',
                    how='inner'
                )
            )
            
            # Aggregate by agent (using lazy frame)
            agent_agg_df = (
                games_with_agents
                .group_by('agent_id')
                .agg([
                    pl.sum('tips').alias('total_tips'),
                    pl.sum('profit').alias('total_profit'),
                    pl.first('deal_percent').alias('deal_percent')
                ])
            )
            
            # Join with agent names (using lazy frame)
            agent_report_df = (
                agent_agg_df
                .join(
                    agents_df.select(['agent_id', 'agent_name']),
                    on='agent_id',
                    how='left'
                )
                .with_columns([
                    (pl.col('total_tips') * pl.col('deal_percent')).alias('agent_tips')
                ])
                .select([
                    pl.col('agent_id'),
                    pl.col('agent_name'),
                    pl.col('total_tips'),
                    pl.col('total_profit'),
                    pl.col('agent_tips')
                ])
                .filter(pl.col('agent_id').is_not_null())
                .collect()
            )
            
            # Convert to list of dictionaries
            agent_report = agent_report_df.to_dicts()
            # Convert numeric values to proper types
            for item in agent_report:
                item['agent_id'] = int(item['agent_id'])
                item['total_tips'] = float(item['total_tips'])
                item['total_profit'] = float(item['total_profit'])
                item['agent_tips'] = float(item['agent_tips'])
        
        return {
            'tips_stats': {
                'total_all_time': round(total_tips_all_time, 2),
                'previous_period': round(previous_period_tips, 2),
                'since_last_thursday': round(since_last_thursday_tips, 2)
            },
            'blocked_players': blocked_players,
            'over_credit_limit_players': over_credit_limit_players,
            'player_aggregates': player_aggregates,
            'agent_report': agent_report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to fetch dashboard data: {str(e)}')


@app.post('/upload_csv')
async def upload_csv(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    try:
        if not file.filename or not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail='File must be a CSV file')
        
        filename = file.filename
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            result = upload_csv_to_games(supabase, tmp_file_path, filename)
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=result['message'])
            
            log_operation(
                supabase=supabase,
                user=current_user,
                operation_type='CREATE',
                table_name=TABLE_GAMES,
                record_id=None,
                operation_data={
                    'filename': filename,
                    'rows_processed': result.get('rows_processed', 0),
                    'rows_inserted': result.get('rows_inserted', 0),
                    'rows_skipped': result.get('rows_skipped', 0)
                }
            )
            
            return result
        finally:
            import os
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to upload CSV: {str(e)}')


@app.post('/send_telegram_message')
async def send_telegram_message(
    agent_id: int = Body(..., description='Agent ID to send message to'),
    message: str = Body(..., description='Message text to send'),
    current_user: User = Depends(get_current_user),
):
    """Send a message to an agent's Telegram chat via bot."""
    try:
        import requests
        
        TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
        if not TELEGRAM_BOT_TOKEN:
            raise HTTPException(status_code=500, detail='TELEGRAM_BOT_TOKEN not configured')
        
        # Get chat_id from database
        mapping_response = supabase.table('agent_telegram_mapping').select('chat_id').eq('agent_id', agent_id).execute()
        
        if not mapping_response.data or len(mapping_response.data) == 0:
            raise HTTPException(status_code=404, detail=f'No Telegram chat_id found for agent_id {agent_id}')
        
        chat_id = mapping_response.data[0]['chat_id']
        
        # Send message via Telegram Bot API
        telegram_api_url = f'https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage'
        payload = {
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'HTML'  # Allows basic HTML formatting
        }
        
        response = requests.post(telegram_api_url, json=payload, timeout=10)
        response.raise_for_status()
        
        return {
            'success': True,
            'message': 'Message sent successfully',
            'chat_id': chat_id
        }
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f'Failed to send Telegram message: {str(e)}')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error sending Telegram message: {str(e)}')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
