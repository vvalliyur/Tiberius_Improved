from datetime import date, datetime, timedelta
import pytz

def resolve_date_range(
    lookback_days: int | None,
    start_date: date | None,
    end_date: date | None
) -> tuple[date, date]:
    if start_date is not None and end_date is not None:
        return start_date, end_date
    elif lookback_days is not None:
        current_date = date.today()
        calculated_start = current_date - timedelta(days=lookback_days)
        return calculated_start, current_date
    else:
        raise ValueError("Either start_date and end_date must be provided, or lookback_days must be provided")


def get_last_thursday_12am_texas():
    """Get the most recent Thursday 12:00 AM Texas time (Central Time)"""
    texas_tz = pytz.timezone('America/Chicago')  # Texas uses Central Time
    now_texas = datetime.now(texas_tz)
    
    # Calculate days to subtract to get to Thursday
    # Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4, Saturday=5, Sunday=6
    days_since_thursday = (now_texas.weekday() - 3) % 7
    if days_since_thursday == 0 and now_texas.hour < 12:
        # If it's Thursday but before 12am, go to previous Thursday
        days_since_thursday = 7
    
    last_thursday = now_texas - timedelta(days=days_since_thursday)
    last_thursday = last_thursday.replace(hour=0, minute=0, second=0, microsecond=0)
    
    return last_thursday


def get_current_week_range():
    """Get the date range for current week: last Thursday 12am Texas time to present moment"""
    last_thursday_texas = get_last_thursday_12am_texas()
    # Convert to date (just the date part, not time)
    start_date = last_thursday_texas.date()
    # Current date in Texas time
    texas_tz = pytz.timezone('America/Chicago')
    now_texas = datetime.now(texas_tz)
    end_date = now_texas.date()
    
    return start_date, end_date

