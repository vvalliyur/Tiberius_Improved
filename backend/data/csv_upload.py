import hashlib
import random
import polars as pl
from datetime import datetime
from pathlib import Path
from supabase.client import Client
from data.schemas.df_schemas import GAME_DATA_MAP


TABLE_GAMES = 'games'
TABLE_UPLOADED_CSVS = 'uploaded_csvs'


def normalize_aggregated_csv(df: pl.DataFrame) -> pl.DataFrame:
    """Normalize aggregated CSV schema to match the standard per-game schema."""
    if 'CG Hands' not in df.columns or 'Rank' in df.columns:
        return df

    # Rename CG Hands -> Hands
    df = df.rename({'CG Hands': 'Hands'})

    # Detect minimal format: CG Hands present but no GameCode/DateStarted/GameType columns
    is_minimal = 'GameCode' not in df.columns

    if is_minimal:
        # Minimal format: Player, ID, Hands, Tips, Profit only
        # Use dummy defaults — user will manually adjust afterwards
        game_code = str(-random.randint(1000000, 9999999))
        date_started = '2000-01-01 00:00'
        date_ended = '2001-01-01 00:00'
        game_type = 'PLO4'
    else:
        # Standard aggregated format with GameCode, DateStarted, GameType
        raw_game_code = str(df.select('GameCode').row(0)[0])
        game_code = raw_game_code.split(',')[0].strip()

        raw_date = str(df.select('DateStarted').row(0)[0])
        if '~' in raw_date:
            parts = raw_date.split('~')
            date_started = parts[0].strip()
            date_ended = parts[1].strip()
        else:
            date_started = raw_date.strip()
            date_ended = raw_date.strip()

        game_type = str(df.select('GameType').row(0)[0]).strip()

    # TotalTips: sum of Tips column
    total_tips = df.select(pl.col('Tips').cast(pl.Float64, strict=False).sum()).row(0)[0] or 0.0

    df = df.with_columns([
        pl.lit(game_code).alias('GameCode'),
        pl.lit(date_started).alias('DateStarted'),
        pl.lit(date_ended).alias('DateEnded'),
        pl.lit(game_type).alias('GameType'),
        pl.arange(1, df.height + 1).alias('Rank'),
        pl.lit(0).alias('BuyIn'),
        pl.lit('DATS').alias('ClubCode'),
        pl.lit(10).alias('BigBlind'),
        pl.lit(total_tips).alias('TotalTips'),
    ])

    # Drop EVCashout if present
    if 'EVCashout' in df.columns:
        df = df.drop('EVCashout')

    return df


def _get_next_unknown_counter(supabase: Client) -> int:
    """Query the games table for the highest existing #UNKN ID and return the next number."""
    try:
        response = (
            supabase.table(TABLE_GAMES)
            .select('player_id')
            .like('player_id', '#UNKN%')
            .execute()
        )
        if response.data:
            max_num = 0
            for row in response.data:
                pid = row['player_id']
                suffix = pid.replace('#UNKN', '')
                if suffix.isdigit():
                    max_num = max(max_num, int(suffix))
            return max_num + 1
        return 1
    except Exception:
        return 1


def rename_unknown_players(df: pl.DataFrame, supabase: Client) -> pl.DataFrame:
    """Rename 'unknown player' entries to 'unknown player N' with unique IDs '#UNKNN'."""
    if 'Player' not in df.columns:
        return df

    player_names = df.get_column('Player').to_list()
    mask = [str(name).strip().lower() == 'unknown player' for name in player_names]

    if not any(mask):
        return df

    counter = _get_next_unknown_counter(supabase)

    new_names = list(player_names)
    player_ids = df.get_column('ID').to_list()
    new_ids = list(player_ids)

    for i, is_unknown in enumerate(mask):
        if is_unknown:
            new_names[i] = f'unknown player {counter}'
            new_ids[i] = f'#UNKN{counter}'
            counter += 1

    df = df.with_columns([
        pl.Series('Player', new_names),
        pl.Series('ID', new_ids),
    ])

    return df


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


def mark_csv_as_uploaded(supabase: Client, csv_hash: str, filename: str, row_count: int, game_code: str | None = None):
    try:
        record = {
            'csv_hash': csv_hash,
            'filename': filename,
            'row_count': row_count,
            'uploaded_at': datetime.now().isoformat()
        }
        if game_code is not None:
            record['game_code'] = game_code
        supabase.table(TABLE_UPLOADED_CSVS).insert(record).execute()
    except Exception as e:
        pass


def upload_csv_to_games(
    supabase: Client,
    csv_path: str | Path,
    filename: str | None = None,
    overrides: dict | None = None,
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
    
    # Try comma first; if it produces a single column, retry with semicolon
    df = pl.read_csv(csv_path)
    if df.width == 1 and ';' in df.columns[0]:
        df = pl.read_csv(csv_path, separator=';')
    df = normalize_aggregated_csv(df)

    # Apply any caller-provided overrides (e.g. specific GameCode, dates, GameType)
    if overrides:
        override_exprs = [pl.lit(v).alias(k) for k, v in overrides.items()]
        df = df.with_columns(override_exprs)

    df = rename_unknown_players(df, supabase)

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

    required_columns = ['Rank', 'Player', 'ID', 'Profit', 'Tips', 'BuyIn']
    missing_columns = [col for col in required_columns if col not in df_processed.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")
    
    select_exprs = []
    for csv_col, db_col in GAME_DATA_MAP.items():
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
    
    game_code = first_row_values.get('GameCode')
    mark_csv_as_uploaded(supabase, csv_hash, filename, len(records), game_code=game_code)
    
    return {
        'success': True,
        'rows_processed': len(records),
        'rows_inserted': rows_inserted,
        'rows_skipped': rows_skipped,
        'message': f"Successfully uploaded {rows_inserted} rows from '{filename}'"
    }
