import hashlib
import polars as pl
from datetime import datetime
from pathlib import Path
from supabase.client import Client
from data.schemas.df_schemas import GAME_DATA_MAP


TABLE_GAMES = 'games'
TABLE_UPLOADED_CSVS = 'uploaded_csvs'


def calculate_csv_hash(csv_path: str | Path) -> str:
    with open(csv_path, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()
    return file_hash


def is_csv_uploaded(supabase: Client, csv_hash: str) -> bool:
    try:
        response = supabase.table(TABLE_UPLOADED_CSVS).select('csv_hash').eq('csv_hash', csv_hash).execute()
        return len(response.data) > 0
    except Exception:
        return False


def mark_csv_as_uploaded(supabase: Client, csv_hash: str, filename: str, row_count: int):
    try:
        supabase.table(TABLE_UPLOADED_CSVS).insert({
            'csv_hash': csv_hash,
            'filename': filename,
            'row_count': row_count,
            'uploaded_at': datetime.now().isoformat()
        }).execute()
    except Exception as e:
        pass


def upload_csv_to_games(
    supabase: Client,
    csv_path: str | Path,
    filename: str | None = None
) -> dict:

    csv_path = Path(csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    if filename is None:
        filename = csv_path.name
    
    csv_hash = calculate_csv_hash(csv_path)
    
    if is_csv_uploaded(supabase, csv_hash):
        return {
            'success': False,
            'rows_processed': 0,
            'rows_inserted': 0,
            'rows_skipped': 0,
            'message': f"CSV '{filename}' has already been uploaded"
        }
    
    df = pl.read_csv(csv_path)
    
    if df.is_empty():
        raise ValueError('CSV file is empty')
    
    first_row_only_columns = ['ClubCode', 'GameCode', 'DateStarted', 'DateEnded', 'GameType', 'BigBlind', 'TotalTips']
    
    first_row_values = {}
    for col in first_row_only_columns:
        if col in df.columns:
            value = df.select(col).row(0)[0]
            if value is not None:
                first_row_values[col] = value
            else:
                raise ValueError(f"Required column '{col}' is missing or empty in first row")
        else:
            raise ValueError(f"Required column '{col}' is missing from CSV")
    
    df_processed = df.clone()
    
    for col in first_row_only_columns:
        df_processed = df_processed.with_columns(pl.lit(first_row_values[col]).alias(col))
    
    
    csv_to_db_mapping = GAME_DATA_MAP
    required_columns = ['Rank', 'Player', 'ID', 'Profit', 'Tips', 'BuyIn']
    missing_columns = [col for col in required_columns if col not in df_processed.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")
    
    select_exprs = []
    for csv_col, db_col in csv_to_db_mapping.items():
        if csv_col in df_processed.columns:
            select_exprs.append(pl.col(csv_col).alias(db_col))
    
    df_processed = df_processed.select(select_exprs)
    
    df_processed = df_processed.with_columns([
        pl.col('date_started').str.strptime(pl.Datetime, format=None, strict=False).alias('date_started'),
        pl.col('date_ended').str.strptime(pl.Datetime, format=None, strict=False).alias('date_ended'),
        pl.col('rank').cast(pl.Int64).alias('rank'),
        pl.col('profit').cast(pl.Float64, strict=False).alias('profit'),
        pl.col('tips').cast(pl.Float64, strict=False).alias('tips'),
        pl.col('buy_in').cast(pl.Float64, strict=False).alias('buy_in'),
        pl.col('big_blind').cast(pl.Float64, strict=False).alias('big_blind'),
        pl.col('total_tips').cast(pl.Float64, strict=False).alias('total_tips')
    ])
    
    null_check = df_processed.select([
        pl.col('profit').is_null().sum(),
        pl.col('tips').is_null().sum(),
        pl.col('buy_in').is_null().sum(),
        pl.col('big_blind').is_null().sum(),
        pl.col('total_tips').is_null().sum()
    ])
    
    total_nulls = sum(null_check.row(0))
    if total_nulls > 0:
        raise ValueError('Numeric columns contain invalid values')
    
    db_columns = [
        'rank', 'game_code', 'club_code', 'player_id', 'player_name',
        'date_started', 'date_ended', 'game_type', 'big_blind',
        'profit', 'tips', 'buy_in', 'total_tips', 'hands'
    ]
    
    df_final = df_processed.select(db_columns)
    
    df_final = df_final.with_columns([
        pl.col('date_started').dt.strftime('%Y-%m-%dT%H:%M:%S').alias('date_started'),
        pl.col('date_ended').dt.strftime('%Y-%m-%dT%H:%M:%S').alias('date_ended')
    ])
    
    records = df_final.to_dicts()
    
    for record in records:
        if isinstance(record.get('date_started'), datetime):
            record['date_started'] = record['date_started'].isoformat()
        if isinstance(record.get('date_ended'), datetime):
            record['date_ended'] = record['date_ended'].isoformat()
    
    rows_inserted = 0
    rows_skipped = 0
    
    batch_size = 100
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            response = supabase.table(TABLE_GAMES).insert(batch).execute()
            rows_inserted += len(response.data) if response.data else 0
        except Exception as e:
            error_str = str(e).lower()
            if 'duplicate' in error_str or 'unique' in error_str or 'primary key' in error_str:
                for record in batch:
                    try:
                        supabase.table(TABLE_GAMES).insert(record).execute()
                        rows_inserted += 1
                    except Exception:
                        rows_skipped += 1
            else:
                raise
    
    mark_csv_as_uploaded(supabase, csv_hash, filename, len(records))
    
    return {
        'success': True,
        'rows_processed': len(records),
        'rows_inserted': rows_inserted,
        'rows_skipped': rows_skipped,
        'message': f"Successfully uploaded {rows_inserted} rows from '{filename}'"
    }
