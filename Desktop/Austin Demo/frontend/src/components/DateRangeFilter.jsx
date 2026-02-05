import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [openCalendar, setOpenCalendar] = useState(null); // 'start' | 'end' | null
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const startDateInputRef = useRef(null);
  const endDateInputRef = useRef(null);
  const startDateContainerRef = useRef(null);
  const endDateContainerRef = useRef(null);
  const calendarRef = useRef(null);

  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    // Parse date string (YYYY-MM-DD) as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return '';
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Format date string (YYYY-MM-DD) to MM/DD/YYYY for input display
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    // Parse as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return '';
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
  };

  // Parse MM/DD/YYYY input to YYYY-MM-DD format (local timezone)
  const parseDateInput = (value) => {
    // Only parse MM/DD/YYYY format
    if (!value || value.trim() === '') return null;
    
    // Try MM/DD/YYYY or M/D/YYYY format
    const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, month, day, year] = slashMatch;
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      const yearNum = parseInt(year);
      
      // Validate date
      const date = new Date(yearNum, monthNum - 1, dayNum);
      if (date.getFullYear() === yearNum && date.getMonth() === monthNum - 1 && date.getDate() === dayNum) {
        // Format as YYYY-MM-DD using local timezone values
        return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      }
    }
    
    return null;
  };

  // Sync input values when dates change externally (e.g., from calendar picker)
  useEffect(() => {
    if (startDate) {
      setStartDateInput(formatDateForInput(startDate));
    } else {
      setStartDateInput('');
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate) {
      setEndDateInput(formatDateForInput(endDate));
    } else {
      setEndDateInput('');
    }
  }, [endDate]);

  const handleDateSelect = (date) => {
    // Format date as YYYY-MM-DD using local timezone to avoid day shift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    if (openCalendar === 'start') {
      onStartDateChange(dateStr);
    } else if (openCalendar === 'end') {
      onEndDateChange(dateStr);
    }
    setOpenCalendar(null);
  };

  const getLastThursday12amTexas = () => {
    const now = new Date();
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
    
    const parts = formatter.formatToParts(now);
    const texasYear = parseInt(parts.find(p => p.type === 'year').value);
    const texasMonth = parseInt(parts.find(p => p.type === 'month').value) - 1;
    const texasDay = parseInt(parts.find(p => p.type === 'day').value);
    const texasHour = parseInt(parts.find(p => p.type === 'hour').value);
    
    const texasDate = new Date(texasYear, texasMonth, texasDay, texasHour);
    
    let daysSinceThursday = (texasDate.getDay() - 4) % 7;
    if (daysSinceThursday < 0) daysSinceThursday += 7;
    
    if (daysSinceThursday === 0 && texasHour < 12) {
      daysSinceThursday = 7;
    }
    
    const lastThursday = new Date(texasYear, texasMonth, texasDay - daysSinceThursday, 0, 0, 0);
    return lastThursday;
  };

  const handleCurrentWeek = () => {
    const lastThursday = getLastThursday12amTexas();
    const today = new Date();
    
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
    
    const formatDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    onStartDateChange(formatDateString(lastThursday));
    onEndDateChange(formatDateString(todayTexas));
    onLookbackDaysChange(null);
  };

  const getQuickDateOptions = () => {
    const today = new Date();
    const options = [];
    
    for (let i = 0; i <= 30; i += 7) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      // Format date as YYYY-MM-DD using local timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      options.push({
        label: i === 0 ? 'Today' : i === 7 ? '7 days ago' : i === 14 ? '14 days ago' : i === 21 ? '21 days ago' : `${i} days ago`,
        date: dateStr,
        days: i
      });
    }
    
    return options;
  };

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target) &&
        startDateInputRef.current &&
        !startDateInputRef.current.contains(event.target) &&
        endDateInputRef.current &&
        !endDateInputRef.current.contains(event.target) &&
        startDateContainerRef.current &&
        !startDateContainerRef.current.contains(event.target) &&
        endDateContainerRef.current &&
        !endDateContainerRef.current.contains(event.target)
      ) {
        setOpenCalendar(null);
      }
    };

    if (openCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openCalendar]);

  const DatePicker = () => {
    if (!openCalendar) return null;

    const selectedDate = openCalendar === 'start' ? startDate : endDate;
    const containerRef = openCalendar === 'start' ? startDateContainerRef : endDateContainerRef;
    const [position, setPosition] = useState({ top: 0, left: 0, visible: false });

    // Use useLayoutEffect for synchronous positioning before paint
    useLayoutEffect(() => {
      const updatePosition = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setPosition({
            top: rect.bottom + 8, // 8px gap below input
            left: rect.left,
            visible: true,
          });
        }
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }, [containerRef, openCalendar]);

    const today = new Date();
    // Parse selectedDate as local date to avoid timezone issues
    let currentMonth = today;
    if (selectedDate) {
      const [year, month, day] = selectedDate.split('-').map(Number);
      if (year && month && day) {
        currentMonth = new Date(year, month - 1, day);
      }
    }
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

    return createPortal(
      <Card
        ref={calendarRef}
        className="fixed z-[100] w-[320px] p-4 shadow-elevated-lg"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          opacity: position.visible ? 1 : 0,
          pointerEvents: position.visible ? 'auto' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Select {openCalendar === 'start' ? 'Start' : 'End'} Date</h3>
            <Button variant="ghost" size="icon" onClick={() => setOpenCalendar(null)} className="h-6 w-6">
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
                  onClick={() => {
                    // Parse date string (YYYY-MM-DD) as local date
                    const [year, month, day] = option.date.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    handleDateSelect(date);
                  }}
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
                // Format date as YYYY-MM-DD using local timezone
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const todayStr = `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const isSelected = selectedDate === dateStr;

                return (
                  <button
                    key={day}
                    onClick={() => handleDateSelect(date)}
                    className={cn(
                      "p-1 text-sm rounded-md transition-colors",
                      isSelected && "bg-primary text-primary-foreground font-semibold",
                      !isSelected && "hover:bg-muted",
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
      </Card>,
      document.body
    );
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="start-date" className="text-sm mb-1.5 block">Start Date</Label>
          <div className="relative" ref={startDateContainerRef}>
            <Input
              id="start-date"
              ref={startDateInputRef}
              type="text"
              className="w-full pr-10"
              value={startDateInput}
              onChange={(e) => {
                const value = e.target.value;
                setStartDateInput(value);
                const parsed = parseDateInput(value);
                if (parsed) {
                  onStartDateChange(parsed);
                } else if (value === '') {
                  onStartDateChange('');
                }
              }}
              onBlur={() => {
                // On blur, if input doesn't match valid date, reset to formatted date
                if (startDateInput && !parseDateInput(startDateInput)) {
                  if (startDate) {
                    setStartDateInput(formatDateForInput(startDate));
                  } else {
                    setStartDateInput('');
                  }
                }
              }}
              onFocus={(e) => {
                e.target.select();
                setOpenCalendar('start');
              }}
              onClick={(e) => {
                e.target.focus();
                e.target.select();
              }}
              placeholder="MM/DD/YYYY"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setOpenCalendar(openCalendar === 'start' ? null : 'start');
              }}
            >
              <Calendar className="h-4 w-4" />
            </Button>
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
        </div>

        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="end-date" className="text-sm mb-1.5 block">End Date</Label>
          <div className="relative" ref={endDateContainerRef}>
            <Input
              id="end-date"
              ref={endDateInputRef}
              type="text"
              className="w-full pr-10"
              value={endDateInput}
              onChange={(e) => {
                const value = e.target.value;
                setEndDateInput(value);
                const parsed = parseDateInput(value);
                if (parsed) {
                  onEndDateChange(parsed);
                } else if (value === '') {
                  onEndDateChange('');
                }
              }}
              onBlur={() => {
                // On blur, if input doesn't match valid date, reset to formatted date
                if (endDateInput && !parseDateInput(endDateInput)) {
                  if (endDate) {
                    setEndDateInput(formatDateForInput(endDate));
                  } else {
                    setEndDateInput('');
                  }
                }
              }}
              onFocus={(e) => {
                e.target.select();
                setOpenCalendar('end');
              }}
              onClick={(e) => {
                e.target.focus();
                e.target.select();
              }}
              placeholder="MM/DD/YYYY"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setOpenCalendar(openCalendar === 'end' ? null : 'end');
              }}
            >
              <Calendar className="h-4 w-4" />
            </Button>
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
        </div>

        {/* Lookback Days selector - commented out, may add back later */}
        {/* <div className="flex-1 min-w-[150px]">
          <Label htmlFor="lookback" className="text-sm mb-1.5 block">Lookback Days</Label>
          <Input
            id="lookback"
            type="number"
            min="1"
            placeholder="e.g., 30"
            value={lookbackDays || ''}
            onChange={(e) => onLookbackDaysChange(e.target.value ? parseInt(e.target.value) : null)}
          />
        </div> */}

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

      <DatePicker />
    </Card>
  );
}
