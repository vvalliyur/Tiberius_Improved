import { useState, useMemo } from 'react';
import { getData, getAggregatedData } from '../utils/api';
import DataTable from '../components/DataTable';
import TableSearchBox from '../components/TableSearchBox';
import DateRangeFilter from '../components/DateRangeFilter';
import { Card, CardHeader } from '../components/ui/card';
import { formatNumber } from '../utils/numberFormat';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('game-data');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lookbackDays, setLookbackDays] = useState(null);
  const [gameData, setGameData] = useState([]);
  const [aggregatedData, setAggregatedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  const gameDataColumns = useMemo(() => [
    { accessorKey: 'game_code', header: 'Game Code' },
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'date_started', header: 'Date Started', cell: info => new Date(info.getValue()).toLocaleString() },
    { accessorKey: 'date_ended', header: 'Date Ended', cell: info => new Date(info.getValue()).toLocaleString() },
    { accessorKey: 'game_type', header: 'Game Type' },
    { accessorKey: 'big_blind', header: 'Big Blind', cell: info => formatNumber(info.getValue()) },
    { accessorKey: 'profit', header: 'Profit', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{formatNumber(value)}</span>;
    }},
    { accessorKey: 'tips', header: 'Tips', cell: info => formatNumber(info.getValue()) },
    { accessorKey: 'buy_in', header: 'Buy In', cell: info => formatNumber(info.getValue()) },
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => formatNumber(info.getValue()) },
  ], []);

  const aggregatedDataColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'total_profit', header: 'Total Profit', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{formatNumber(value)}</span>;
    }},
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => formatNumber(info.getValue()) },
    { accessorKey: 'game_count', header: 'Game Count' },
  ], []);

  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    if (!year || !month || !day) return '';
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleFetch = async () => {
    if (!startDate || !endDate) {
      setError('Please provide both start date and end date');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Fetch both datasets in parallel
      const [gameDataResponse, aggregatedDataResponse] = await Promise.all([
        getData(startDate || null, endDate || null, null, null),
        getAggregatedData(startDate || null, endDate || null, null)
      ]);
      setGameData(gameDataResponse.data || []);
      setAggregatedData(aggregatedDataResponse.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch data');
      setGameData([]);
      setAggregatedData([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3 w-full">
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        lookbackDays={lookbackDays}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onLookbackDaysChange={setLookbackDays}
        onFetch={handleFetch}
        isLoading={isLoading}
        showClubCode={false}
      />

      {error && (
        <div className="rounded-xl border-2 border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive shadow-sm">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
                <button
                  className={`px-6 py-2.5 font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'game-data'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  onClick={() => setActiveTab('game-data')}
                >
                  Game Data
                </button>
                <button
                  className={`px-6 py-2.5 font-medium rounded-md transition-all duration-200 ${
                    activeTab === 'aggregated'
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  onClick={() => setActiveTab('aggregated')}
                >
                  Aggregated Data
                </button>
              </div>
              {startDate && endDate && (
                <span className="text-sm text-muted-foreground">
                  {formatDisplayDate(startDate)} to {formatDisplayDate(endDate)}
                </span>
              )}
            </div>
            <TableSearchBox
              value={searchFilter}
              onChange={setSearchFilter}
            />
          </div>
        </CardHeader>
        <DataTable
          data={activeTab === 'game-data' ? gameData : aggregatedData}
          columns={activeTab === 'game-data' ? gameDataColumns : aggregatedDataColumns}
          isLoading={isLoading}
          emptyMessage={`No ${activeTab === 'game-data' ? 'game data' : 'aggregated data'} available`}
          globalFilter={searchFilter}
          onGlobalFilterChange={setSearchFilter}
          hideSearch={true}
        />
      </Card>
    </div>
  );
}

export default Dashboard;

