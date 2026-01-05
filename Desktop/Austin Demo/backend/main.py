import sys
from pathlib import Path

backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI, HTTPException, Query, Path, UploadFile, File, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from datetime import date
from supabase.client import create_client, Client
import os
from dotenv import load_dotenv
import polars as pl
from data.schemas.df_schemas import User, GameDataS, AgentS, PlayerS
from utils.auth_utils import create_get_current_user
from utils.datetime_utils import resolve_date_range
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
    raise ValueError('SUPABASE_URL and SUPABASE_KEY must be set in environment variables')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

security = HTTPBearer()
get_current_user = create_get_current_user(security, SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET)


def response_to_lazyframe(response_data: list) -> pl.LazyFrame:
    if not response_data:
        return pl.LazyFrame()
    return pl.DataFrame(response_data).lazy()


@app.get('/')
async def root():
    return {'message': 'Poker Accounting System API'}


@app.get('/health')
async def health_check():
    return {'status': 'healthy'}


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
    current_user: User = Depends(get_current_user),
):
    try:
        resolved_start, resolved_end = resolve_date_range(lookback_days, start_date, end_date)
        
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
        
        response = query.execute()
        
        if not response.data:
            return {
                "aggregated": [],
                "individual_records": [],
                "aggregated_count": 0,
                "individual_count": 0
            }
        
        df = response_to_lazyframe(response.data)
        
        unique_player_ids_from_games = df.select('player_id').unique().collect().to_series().to_list()
        numeric_player_ids = []
        for pid in unique_player_ids_from_games:
            try:
                numeric_player_ids.append(int(pid))
            except (ValueError, TypeError):
                continue
        
        players_dict = {}
        player_id_to_agent = {}
        if numeric_player_ids:
            players_response = supabase.table(TABLE_PLAYERS).select('player_id, agent_id').in_('player_id', numeric_player_ids).execute()
            for p in players_response.data:
                player_id_int = p['player_id']
                player_id_str = str(player_id_int)
                players_dict[player_id_str] = p.get('agent_id')
                player_id_to_agent[player_id_str] = p.get('agent_id')
        
        agent_ids = [a for a in players_dict.values() if a is not None]
        agents_dict = {}
        if agent_ids:
            agents_response = supabase.table(TABLE_AGENTS).select('agent_id, deal_percent').in_('agent_id', agent_ids).execute()
            for a in agents_response.data:
                agents_dict[a['agent_id']] = float(a.get('deal_percent', 0))
        
        aggregated = (
            df
            .group_by('player_id', 'player_name')
            .agg([
                pl.sum('profit').alias('total_profit'),
                pl.sum('tips').alias('total_tips'),
                pl.count().alias('game_count')
            ])
            .collect()
        )
        
        aggregated_list = aggregated.to_dicts()
        
        for item in aggregated_list:
            player_id_str = str(item['player_id'])
            agent_id = player_id_to_agent.get(player_id_str)
            total_tips = float(item['total_tips'])
            if agent_id and agent_id in agents_dict:
                deal_percent = agents_dict[agent_id]
                item['agent_tips'] = round(total_tips * deal_percent / 100.0, 2)
            else:
                item['agent_tips'] = 0.0
            item['takehome_tips'] = round(total_tips - item['agent_tips'], 2)
        
        aggregated_data = aggregated_list
        individual_records = response.data
        
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
            'notes': player_data.notes,
            'comm_channel': player_data.comm_channel,
            'payment_methods': player_data.payment_methods
        }
        data = {k: v for k, v in data.items() if v is not None}
        
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


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
