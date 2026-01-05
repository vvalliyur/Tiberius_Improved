import { useState } from 'react';
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

  const formatDate = (dateString) => {
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

  const CalendarPopup = ({ show, onClose, selectedDate, onSelect, type }) => {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <Card className="relative z-50 w-[320px] p-4 shadow-elevated-lg" onClick={(e) => e.stopPropagation()}>
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
      </div>
    );
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="start-date" className="text-sm mb-1.5 block">Start Date</Label>
          <div className="relative">
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
              onClick={() => {
                setShowStartCalendar(true);
                setShowEndCalendar(false);
              }}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {formatDate(startDate)}
            </Button>
            {startDate && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
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
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="end-date" className="text-sm mb-1.5 block">End Date</Label>
          <div className="relative">
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
              onClick={() => {
                setShowEndCalendar(true);
                setShowStartCalendar(false);
              }}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {formatDate(endDate)}
            </Button>
            {endDate && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
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
                ? `Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`
                : startDate
                  ? `Start date: ${formatDate(startDate)}`
                  : endDate
                    ? `End date: ${formatDate(endDate)}`
                    : ''}
          </p>
        </div>
      )}
    </Card>
  );
}
