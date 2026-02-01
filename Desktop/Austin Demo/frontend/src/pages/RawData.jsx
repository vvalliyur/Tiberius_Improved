import { useState, useMemo } from 'react';
import { getData, getAggregatedData } from '../utils/api';
import DataTable from '../components/DataTable';
import TableSearchBox from '../components/TableSearchBox';
import DateRangeFilter from '../components/DateRangeFilter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

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
    { accessorKey: 'big_blind', header: 'Big Blind', cell: info => Number(info.getValue()).toFixed(2) },
    { accessorKey: 'profit', header: 'Profit', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{value.toFixed(2)}</span>;
    }},
    { accessorKey: 'tips', header: 'Tips', cell: info => Number(info.getValue()).toFixed(2) },
    { accessorKey: 'buy_in', header: 'Buy In', cell: info => Number(info.getValue()).toFixed(2) },
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => Number(info.getValue()).toFixed(2) },
  ], []);

  const aggregatedDataColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'total_profit', header: 'Total Profit', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{value.toFixed(2)}</span>;
    }},
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => Number(info.getValue()).toFixed(2) },
    { accessorKey: 'game_count', header: 'Game Count' },
  ], []);

  const handleFetchGameData = async () => {
    if (!startDate || !endDate) {
      setError('Please provide both start date and end date');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // lookbackDays always null - commented out feature
      const response = await getData(startDate || null, endDate || null, null, null);
      setGameData(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch game data');
      setGameData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchAggregatedData = async () => {
    if (!startDate || !endDate) {
      setError('Please provide both start date and end date');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // lookbackDays always null - commented out feature
      const response = await getAggregatedData(startDate || null, endDate || null, null);
      setAggregatedData(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch aggregated data');
      setAggregatedData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetch = () => {
    if (activeTab === 'game-data') {
      handleFetchGameData();
    } else {
      handleFetchAggregatedData();
    }
  };

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-2 h-[88px] flex flex-col justify-center">
        <h1 className="text-4xl font-bold tracking-tight">Raw Data</h1>
        <p className="text-lg text-muted-foreground">View game data and aggregated statistics</p>
      </div>

      <div className="flex gap-2 p-1 bg-muted/50 rounded-lg w-fit">
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
          <CardTitle>
            {activeTab === 'game-data' ? 'Game Data' : 'Aggregated Data by Player'}
          </CardTitle>
          <TableSearchBox
            value={searchFilter}
            onChange={setSearchFilter}
          />
        </CardHeader>
        <CardContent className="p-6">
          <DataTable
            data={activeTab === 'game-data' ? gameData : aggregatedData}
            columns={activeTab === 'game-data' ? gameDataColumns : aggregatedDataColumns}
            isLoading={isLoading}
            emptyMessage={`No ${activeTab === 'game-data' ? 'game data' : 'aggregated data'} available`}
            globalFilter={searchFilter}
            onGlobalFilterChange={setSearchFilter}
            hideSearch={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;

