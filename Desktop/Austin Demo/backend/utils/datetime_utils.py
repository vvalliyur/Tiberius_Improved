from datetime import date, timedelta

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

