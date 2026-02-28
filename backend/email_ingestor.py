import os
import email
import email.message
import imaplib
import logging
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from typing import Any
from email.utils import parsedate_to_datetime
import polars as pl
from supabase.client import Client

logger = logging.getLogger(__name__)

from data.schemas.df_schemas import GAME_DATA_MAP
from data.csv_upload import upload_csv_to_games

GMAIL_IMAP_SERVER = 'imap.gmail.com'
GMAIL_IMAP_PORT = 993
DEFAULT_STATE_TABLE = 'email_ingestor_state'


def get_last_run_time(supabase: Client, state_table: str = DEFAULT_STATE_TABLE) -> datetime | None:
    try:
        response = supabase.table(state_table).select('last_run_time').eq('id', 1).execute()
        if response.data and len(response.data) > 0:
            last_run_str = response.data[0].get('last_run_time')
            if last_run_str:
                return datetime.fromisoformat(last_run_str.replace('Z', '+00:00'))
    except Exception as e:
        logger.error("Failed to fetch last run time from '%s': %s", state_table, e)
    return None


def update_last_run_time(supabase: Client, run_time: datetime, state_table: str = DEFAULT_STATE_TABLE):
    try:
        run_time_iso = run_time.isoformat()
        response = supabase.table(state_table).update({
            'last_run_time': run_time_iso,
            'updated_at': run_time_iso
        }).eq('id', 1).execute()
        
        if not response.data:
            supabase.table(state_table).insert({
                'id': 1,
                'last_run_time': run_time_iso,
                'created_at': run_time_iso,
                'updated_at': run_time_iso
            }).execute()
    except Exception as e:
        logger.error("Failed to update last run time in '%s': %s", state_table, e)


def connect_imap(user_email: str, app_password: str) -> imaplib.IMAP4_SSL:
    mail = imaplib.IMAP4_SSL(GMAIL_IMAP_SERVER, GMAIL_IMAP_PORT)
    mail.login(user_email, app_password)
    mail.select('INBOX')
    return mail


def search_emails_with_csv_attachments(
    mail: imaplib.IMAP4_SSL,
    after_date: datetime | None = None
) -> list[str]:
    """Search for emails with CSV attachments after the given date."""
    search_criteria = ['ALL']

    if after_date:
        date_str = after_date.strftime('%d-%b-%Y')
        search_criteria = [f'SINCE {date_str}']

    status, message_ids = mail.search(None, *search_criteria)
    
    if status != 'OK' or not message_ids or not message_ids[0]:
        return []
    
    return [uid.decode() if isinstance(uid, bytes) else uid for uid in message_ids[0].split()]


def get_email_message(mail: imaplib.IMAP4_SSL, uid: str) -> email.message.Message:
    """Fetch and parse an email message by UID."""
    status, msg_data = mail.fetch(uid, '(RFC822)')
    if status != 'OK' or not msg_data or not msg_data[0]:
        raise ValueError(f"Failed to fetch email {uid}")
    
    raw_email = msg_data[0][1]
    if isinstance(raw_email, bytes):
        return email.message_from_bytes(raw_email)
    else:
        return email.message_from_string(str(raw_email))


def get_csv_attachments(message: email.message.Message) -> list[dict[str, Any]]:
    """Extract CSV attachments from an email message."""
    attachments = []
    
    def extract_attachments(part: email.message.Message):
        if part.get_content_disposition() == 'attachment':
            filename = part.get_filename()
            if filename and filename.lower().endswith('.csv'):
                payload = part.get_payload(decode=True)
                if payload:
                    attachments.append({
                        'filename': filename,
                        'data': payload
                    })
        
        if part.is_multipart():
            for subpart in part.walk():
                if subpart != part:  # Avoid processing the same part twice
                    extract_attachments(subpart)
    
    extract_attachments(message)
    return attachments


def validate_csv_columns(csv_path: Path) -> bool:
    """Validate that CSV has the required columns matching GAME_DATA_MAP."""
    try:
        df = pl.read_csv(csv_path)
        
        if df.is_empty():
            return False
        
        required_columns = ['Rank', 'Player', 'ID', 'Profit', 'Tips', 'BuyIn']
        missing_required = [col for col in required_columns if col not in df.columns]
        if missing_required:
            return False
        
        game_data_map_keys = set(GAME_DATA_MAP.keys())
        csv_columns = set(df.columns)
        matching_columns = game_data_map_keys.intersection(csv_columns)
        
        if len(matching_columns) < len(required_columns):
            return False
        
        return True
    except Exception as e:
        return False


def process_email_attachments(
    mail: imaplib.IMAP4_SSL,
    supabase: Client,
    uid: str,
    message: email.message.Message,
    dry_run: bool = False
) -> dict[str, Any]:
    """Process CSV attachments from an email message."""
    results = {
        'email_id': uid,
        'email_subject': message.get('Subject', ''),
        'attachments_processed': 0,
        'attachments_uploaded': 0,
        'attachments_skipped': 0,
        'errors': []
    }
    
    attachments = get_csv_attachments(message)
    results['attachments_found'] = len(attachments)
    
    for attachment in attachments:
        filename = attachment['filename']
        file_data = attachment['data']
        
        try:
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as tmp_file:
                tmp_path = Path(tmp_file.name)
                tmp_file.write(file_data)
                tmp_file.flush()
            
            if not validate_csv_columns(tmp_path):
                results['attachments_skipped'] += 1
                results['errors'].append(f"{filename}: Invalid CSV columns")
                tmp_path.unlink()
                continue
            
            if dry_run:
                results['attachments_processed'] += 1
                results['errors'].append(f"{filename}: DRY RUN - would upload")
                tmp_path.unlink()
                continue

            upload_result = upload_csv_to_games(supabase, tmp_path, filename)
            
            if upload_result.get('success'):
                results['attachments_uploaded'] += 1
            else:
                results['attachments_skipped'] += 1
                results['errors'].append(f"{filename}: {upload_result.get('message', 'Upload failed')}")
            
            results['attachments_processed'] += 1
            tmp_path.unlink()
            
        except Exception as e:
            results['attachments_skipped'] += 1
            results['errors'].append(f"{filename}: {str(e)}")
            if 'tmp_path' in locals():
                try:
                    tmp_path.unlink()
                except Exception:
                    pass  # Best-effort cleanup; not critical
    
    return results


def run_email_ingestor(
    supabase: Client,
    user_email: str,
    app_password: str,
    state_table: str = DEFAULT_STATE_TABLE,
    dry_run: bool = False
) -> dict[str, Any]:

    start_time = datetime.now(timezone.utc)
    summary = {
        'success': True,
        'start_time': start_time.isoformat(),
        'emails_processed': 0,
        'emails_with_attachments': 0,
        'attachments_uploaded': 0,
        'attachments_skipped': 0,
        'errors': []
    }
    
    mail = None
    try:
        last_run = get_last_run_time(supabase, state_table)
        mail = connect_imap(user_email, app_password)
        
        email_uids = search_emails_with_csv_attachments(mail, last_run)
        
        for uid in email_uids:
            try:
                message = get_email_message(mail, uid)
                result = process_email_attachments(mail, supabase, uid, message, dry_run)
                summary['emails_processed'] += 1
                
                if result['attachments_found'] > 0:
                    summary['emails_with_attachments'] += 1
                
                summary['attachments_uploaded'] += result['attachments_uploaded']
                summary['attachments_skipped'] += result['attachments_skipped']
                
                if result['errors']:
                    summary['errors'].extend(result['errors'])
            except Exception as e:
                summary['errors'].append(f"Error processing email {uid}: {str(e)}")
                continue
        
        end_time = datetime.now(timezone.utc)
        update_last_run_time(supabase, end_time, state_table)
        summary['end_time'] = end_time.isoformat()
        summary['duration_seconds'] = (end_time - start_time).total_seconds()
        
    except Exception as e:
        summary['success'] = False
        summary['error'] = str(e)
    finally:
        if mail:
            try:
                mail.close()
                mail.logout()
            except Exception:
                pass  # Best-effort IMAP cleanup
    
    return summary


if __name__ == '__main__':
    import sys
    from pathlib import Path
    from supabase.client import create_client
    from dotenv import load_dotenv
    
    backend_dir = Path(__file__).parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    
    load_dotenv()  # Load .env as base
    app_env = os.getenv('APP_ENV', 'development')
    env_file = Path(__file__).parent / f'.env.{app_env}'
    if env_file.exists():
        load_dotenv(env_file, override=True)  # Override with env-specific values
    SUPABASE_URL = os.getenv('SUPABASE_URL', '')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')
    GMAIL_USER_EMAIL = os.getenv('GMAIL_USER_EMAIL', '')
    GMAIL_APP_PASSWORD = os.getenv('GMAIL_APP_PASSWORD', '')

    if not SUPABASE_URL or not SUPABASE_KEY or not GMAIL_USER_EMAIL or not GMAIL_APP_PASSWORD:
        print("ERROR: Missing required environment variables. Check .env file.")
        sys.exit(1)
        
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"Running email ingestor for {GMAIL_USER_EMAIL}")
    result = run_email_ingestor(
        supabase=supabase,
        user_email=GMAIL_USER_EMAIL,
        app_password=GMAIL_APP_PASSWORD,
        dry_run=False
    )
    print(result)
