from supabase.client import Client
from data.schemas.df_schemas import User

TABLE_AUDIT_LOGS = 'audit_logs'

def log_operation(
    supabase: Client,
    user: User,
    operation_type: str,
    table_name: str,
    record_id: str | int | None = None,
    operation_data: dict | None = None
):
    try:
        log_entry = {
            'user_id': user.id,
            'user_email': user.email,
            'operation_type': operation_type,
            'table_name': table_name,
            'record_id': str(record_id) if record_id is not None else None,
            'operation_data': operation_data
        }
        
        supabase.table(TABLE_AUDIT_LOGS).insert(log_entry).execute()
    except Exception as e:
        pass

