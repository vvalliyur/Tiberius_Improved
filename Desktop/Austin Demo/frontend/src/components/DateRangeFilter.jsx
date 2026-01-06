import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';

export default function DateRangeFilter({ 
  startDate, 
  endDate, 
  lookbackDays, 
  clubCode,
  onStartDateChange, 
  onEndDateChange, 
  onLookbackDaysChange,
  onClubCodeChange,
  onFetch,
  isLoading,
  showClubCode = false
}) {
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const startDateInputRef = useRef(null);
  const endDateInputRef = useRef(null);
  const startCalendarRef = useRef(null);
  const endCalendarRef = useRef(null);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    // Return in YYYY-MM-DD format for input type="date"
    return dateString;
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDateClick = (date, type) => {
    const dateStr = date.toISOString().split('T')[0];
    if (type === 'start') {
      onStartDateChange(dateStr);
      setShowStartCalendar(false);
    } else {
      onEndDateChange(dateStr);
      setShowEndCalendar(false);
    }
  };

  const getLastThursday12amTexas = () => {
    // Get current time in Texas time (America/Chicago - Central Time)
    const now = new Date();
    
    // Create a formatter for Texas timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Get Texas time components
    const parts = formatter.formatToParts(now);
    const texasYear = parseInt(parts.find(p => p.type === 'year').value);
    const texasMonth = parseInt(parts.find(p => p.type === 'month').value) - 1; // Month is 0-indexed
    const texasDay = parseInt(parts.find(p => p.type === 'day').value);
    const texasHour = parseInt(parts.find(p => p.type === 'hour').value);
    
    // Create a date object representing the Texas time
    // We'll work with UTC and adjust, but it's easier to work with local representation
    const texasDate = new Date(texasYear, texasMonth, texasDay, texasHour);
    
    // Calculate days since Thursday (Thursday = 4 in getDay())
    let daysSinceThursday = (texasDate.getDay() - 4) % 7;
    if (daysSinceThursday < 0) daysSinceThursday += 7;
    
    // If it's Thursday but before 12am, go to previous Thursday
    if (daysSinceThursday === 0 && texasHour < 12) {
      daysSinceThursday = 7;
    }
    
    // Calculate last Thursday in Texas time
    const lastThursday = new Date(texasYear, texasMonth, texasDay - daysSinceThursday, 0, 0, 0);
    
    return lastThursday;
  };

  const handleCurrentWeek = () => {
    const lastThursday = getLastThursday12amTexas();
    const today = new Date();
    
    // Get today's date in Texas timezone for end date
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const todayParts = formatter.formatToParts(today);
    const todayYear = parseInt(todayParts.find(p => p.type === 'year').value);
    const todayMonth = parseInt(todayParts.find(p => p.type === 'month').value) - 1;
    const todayDay = parseInt(todayParts.find(p => p.type === 'day').value);
    const todayTexas = new Date(todayYear, todayMonth, todayDay);
    
    // Format dates as YYYY-MM-DD
    const formatDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const startDateStr = formatDateString(lastThursday);
    const endDateStr = formatDateString(todayTexas);
    
    onStartDateChange(startDateStr);
    onEndDateChange(endDateStr);
    onLookbackDaysChange(null); // Clear lookback days when using current week
  };

  const getQuickDateOptions = () => {
    const today = new Date();
    const options = [];
    
    for (let i = 0; i <= 30; i += 7) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      options.push({
        label: i === 0 ? 'Today' : i === 7 ? '7 days ago' : i === 14 ? '14 days ago' : i === 21 ? '21 days ago' : `${i} days ago`,
        date: date.toISOString().split('T')[0],
        days: i
      });
    }
    
    return options;
  };

  const CalendarPopup = ({ show, onClose, selectedDate, onSelect, type, inputRef, calendarRef }) => {
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
      if (show && inputRef?.current) {
        const inputRect = inputRef.current.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        
        setPosition({
          top: inputRect.bottom + scrollY + 4,
          left: inputRect.left + scrollX,
        });
      }
    }, [show, inputRef]);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          calendarRef?.current &&
          !calendarRef.current.contains(event.target) &&
          inputRef?.current &&
          !inputRef.current.contains(event.target)
        ) {
          onClose();
        }
      };

      if (show) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }
    }, [show, onClose, calendarRef, inputRef]);

    if (!show) return null;

    const today = new Date();
    const currentMonth = selectedDate ? new Date(selectedDate + 'T00:00:00') : today;
    const [viewMonth, setViewMonth] = useState(currentMonth.getMonth());
    const [viewYear, setViewYear] = useState(currentMonth.getFullYear());

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

    const navigateMonth = (direction) => {
      if (direction === 'prev') {
        if (viewMonth === 0) {
          setViewMonth(11);
          setViewYear(viewYear - 1);
        } else {
          setViewMonth(viewMonth - 1);
        }
      } else {
        if (viewMonth === 11) {
          setViewMonth(0);
          setViewYear(viewYear + 1);
        } else {
          setViewMonth(viewMonth + 1);
        }
      }
    };

    const quickOptions = getQuickDateOptions();

    return (
      <Card
        ref={calendarRef}
        className="fixed z-50 w-[320px] p-4 shadow-elevated-lg"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Select {type === 'start' ? 'Start' : 'End'} Date</h3>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Quick Select</p>
              <div className="grid grid-cols-2 gap-2">
                {quickOptions.slice(0, 6).map((option) => (
                  <Button
                    key={option.days}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => handleDateClick(new Date(option.date), type)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')} className="h-8 w-8">
                  <span>‹</span>
                </Button>
                <span className="font-semibold">{monthNames[viewMonth]} {viewYear}</span>
                <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')} className="h-8 w-8">
                  <span>›</span>
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground p-1">
                    {day}
                  </div>
                ))}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-1" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(viewYear, viewMonth, day);
                  date.setHours(0, 0, 0, 0);
                  const todayStart = new Date(today);
                  todayStart.setHours(0, 0, 0, 0);
                  const dateStr = date.toISOString().split('T')[0];
                  const isToday = dateStr === todayStart.toISOString().split('T')[0];
                  const isSelected = selectedDate === dateStr;
                  const isPast = date < todayStart && !isToday;

                  return (
                    <button
                      key={day}
                      onClick={() => handleDateClick(date, type)}
                      disabled={isPast}
                      className={cn(
                        "p-1 text-sm rounded-md transition-colors",
                        isSelected && "bg-primary text-primary-foreground font-semibold",
                        !isSelected && !isPast && "hover:bg-muted",
                        isPast && "opacity-30 cursor-not-allowed",
                        isToday && !isSelected && "bg-muted font-medium"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
    );
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="start-date" className="text-sm mb-1.5 block">Start Date</Label>
          <div className="relative">
            <div className="relative">
              <Input
                id="start-date"
                ref={startDateInputRef}
                type="date"
                className="w-full pr-10"
                value={formatDate(startDate)}
                onChange={(e) => {
                  onStartDateChange(e.target.value);
                }}
                onFocus={() => {
                  setShowStartCalendar(true);
                  setShowEndCalendar(false);
                }}
                placeholder="Select start date"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStartCalendar(!showStartCalendar);
                  setShowEndCalendar(false);
                }}
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
            {startDate && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-9 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartDateChange('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <CalendarPopup
            show={showStartCalendar}
            onClose={() => setShowStartCalendar(false)}
            selectedDate={startDate}
            onSelect={(date) => handleDateClick(date, 'start')}
            type="start"
            inputRef={startDateInputRef}
            calendarRef={startCalendarRef}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="end-date" className="text-sm mb-1.5 block">End Date</Label>
          <div className="relative">
            <div className="relative">
              <Input
                id="end-date"
                ref={endDateInputRef}
                type="date"
                className="w-full pr-10"
                value={formatDate(endDate)}
                onChange={(e) => {
                  onEndDateChange(e.target.value);
                }}
                onFocus={() => {
                  setShowEndCalendar(true);
                  setShowStartCalendar(false);
                }}
                placeholder="Select end date"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEndCalendar(!showEndCalendar);
                  setShowStartCalendar(false);
                }}
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
            {endDate && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-9 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEndDateChange('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <CalendarPopup
            show={showEndCalendar}
            onClose={() => setShowEndCalendar(false)}
            selectedDate={endDate}
            onSelect={(date) => handleDateClick(date, 'end')}
            type="end"
            inputRef={endDateInputRef}
            calendarRef={endCalendarRef}
          />
        </div>

        <div className="flex-1 min-w-[150px]">
          <Label htmlFor="lookback" className="text-sm mb-1.5 block">Lookback Days</Label>
          <Input
            id="lookback"
            type="number"
            min="1"
            placeholder="e.g., 30"
            value={lookbackDays || ''}
            onChange={(e) => onLookbackDaysChange(e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>

        <div className="flex-shrink-0">
          <Button 
            variant="outline"
            onClick={handleCurrentWeek}
            className="min-w-[140px]"
          >
            Current Week
          </Button>
        </div>

        {showClubCode && (
          <div className="flex-1 min-w-[150px]">
            <Label htmlFor="club-code" className="text-sm mb-1.5 block">Club Code</Label>
            <Input
              id="club-code"
              type="text"
              placeholder="Enter club code"
              value={clubCode || ''}
              onChange={(e) => onClubCodeChange(e.target.value)}
            />
          </div>
        )}

        <div className="flex-shrink-0">
          <Button 
            onClick={onFetch} 
            disabled={isLoading}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Loading...
              </>
            ) : (
              'Fetch Data'
            )}
          </Button>
        </div>
      </div>

      {(startDate || endDate || lookbackDays) && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            {lookbackDays 
              ? `Using lookback: ${lookbackDays} days from today`
              : startDate && endDate 
                ? `Date range: ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`
                : startDate
                  ? `Start date: ${formatDisplayDate(startDate)}`
                  : endDate
                    ? `End date: ${formatDisplayDate(endDate)}`
                    : ''}
          </p>
        </div>
      )}
    </Card>
  );
}
