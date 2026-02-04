import { useState, useMemo, useEffect } from 'react';
import { getPlayerHistory, getPlayers, getAgents } from '../utils/api';
import DataTable from '../components/DataTable';
import TableSearchBox from '../components/TableSearchBox';
import DateRangeFilter from '../components/DateRangeFilter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { formatNumber } from '../utils/numberFormat';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useScrollbar } from '../hooks/useScrollbar';

function History() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lookbackDays, setLookbackDays] = useState(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [players, setPlayers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [aggregatedData, setAggregatedData] = useState([]);
  const [individualRecords, setIndividualRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [error, setError] = useState(null);
  const [aggregatedSearch, setAggregatedSearch] = useState('');
  const [individualSearch, setIndividualSearch] = useState('');

  const playerListRef = useScrollbar();
  const mainContentRef = useScrollbar();

  useEffect(() => {
    fetchPlayersAndAgents();
  }, []);

  const fetchPlayersAndAgents = async () => {
    setIsLoadingPlayers(true);
    try {
      const [playersResponse, agentsResponse] = await Promise.all([
        getPlayers(),
        getAgents()
      ]);
      setPlayers(playersResponse.data || []);
      setAgents(agentsResponse.data || []);
    } catch (err) {
      // Error handled silently
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const filteredPlayers = useMemo(() => {
    let filtered = players;

    if (selectedAgentId) {
      filtered = filtered.filter(player => player.agent_id === parseInt(selectedAgentId));
    }

    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(player =>
        player.player_name.toLowerCase().includes(lowerCaseQuery) ||
        String(player.player_id).includes(lowerCaseQuery) ||
        (player.agent_name && player.agent_name.toLowerCase().includes(lowerCaseQuery))
      );
    }
    return filtered;
  }, [players, selectedAgentId, searchQuery]);

  const handlePlayerToggle = (playerId) => {
    setSelectedPlayerIds(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        return [...prev, playerId];
      }
    });
  };

  const handleSelectAll = () => {
    const currentFilteredPlayerIds = filteredPlayers.map(p => p.player_id);
    const allSelected = currentFilteredPlayerIds.every(id => selectedPlayerIds.includes(id));

    if (allSelected) {
      setSelectedPlayerIds(prev => prev.filter(id => !currentFilteredPlayerIds.includes(id)));
    } else {
      setSelectedPlayerIds(prev => [...new Set([...prev, ...currentFilteredPlayerIds])]);
    }
  };

  const handleFetch = async () => {
    if (selectedPlayerIds.length === 0) {
      setError('Please select at least one player');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const playerIdsString = selectedPlayerIds.join(',');
      // lookbackDays always null - commented out feature
      const response = await getPlayerHistory(
        startDate || null,
        endDate || null,
        playerIdsString,
        null
      );
      setAggregatedData(response.aggregated || []);
      setIndividualRecords(response.individual_records || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch player history');
      setAggregatedData([]);
      setIndividualRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const aggregatedColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'game_count', header: 'Total Hands' },
    { accessorKey: 'total_profit', header: 'Total Profit', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{formatNumber(value)}</span>;
    }},
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => formatNumber(info.getValue()) },
    { accessorKey: 'agent_tips', header: 'Agent Tips', cell: info => formatNumber(info.getValue() || 0) },
    { accessorKey: 'takehome_tips', header: 'Takehome Tips', cell: info => formatNumber(info.getValue() || 0) },
  ], []);

  const individualColumns = useMemo(() => [
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
  ], []);

  const selectedCount = selectedPlayerIds.length;

  return (
    <div className="w-full h-full" data-page-container style={{ height: 'calc(100vh - 100px)' }}>
      <div className="flex gap-6 h-full">
        <div className="w-80 flex-shrink-0" style={{ width: '320px', minWidth: '320px', maxWidth: '320px' }}>
          <Card className="h-full flex flex-col shadow-elevated">
            <CardHeader className="bg-muted/30 border-b flex-shrink-0">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg">Players</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={filteredPlayers.length === 0}
                  className="rounded-full ml-auto"
                >
                  {selectedCount === filteredPlayers.length && filteredPlayers.length > 0 ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 flex-1 overflow-hidden">
              <div className="space-y-2 flex-shrink-0">
                <Label htmlFor="search-players">Search</Label>
                <Input
                  id="search-players"
                  type="text"
                  placeholder="Search by name, ID, or agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2 flex-shrink-0">
                <Label htmlFor="filter-agent">Filter by Agent</Label>
                <Select
                  value={selectedAgentId}
                  onValueChange={setSelectedAgentId}
                >
                  <SelectTrigger id="filter-agent">
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Agents</SelectItem>
                    {agents.map(agent => (
                      <SelectItem key={agent.agent_id} value={String(agent.agent_id)}>
                        {agent.agent_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div ref={playerListRef} className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoadingPlayers ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  </div>
                ) : filteredPlayers.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    No players found matching your criteria
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredPlayers.map((player) => (
                      <div
                        key={player.player_id}
                        className={`flex flex-col p-3 rounded-md cursor-pointer transition-colors ${
                          selectedPlayerIds.includes(player.player_id)
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => handlePlayerToggle(player.player_id)}
                      >
                        <div className="font-semibold text-base mb-1.5">{player.player_name}</div>
                        <div className={`flex items-center gap-2 flex-wrap ${
                          selectedPlayerIds.includes(player.player_id)
                            ? 'text-primary-foreground/90'
                            : 'text-muted-foreground'
                        }`}>
                          <span className="font-bold text-sm">{player.player_id}</span>
                          {player.agent_name && (
                            <>
                              <span className="text-xs">•</span>
                              <span className="font-semibold text-sm">{player.agent_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-shrink-0 space-y-4 pb-4">
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
          </div>

          <div ref={mainContentRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
            {aggregatedData.length > 0 && (
              <Card className="overflow-visible">
                <CardHeader className="bg-muted/30 border-b flex-shrink-0">
                  <CardTitle>Aggregated Statistics</CardTitle>
                  <TableSearchBox
                    value={aggregatedSearch}
                    onChange={setAggregatedSearch}
                  />
                </CardHeader>
                <DataTable
                  data={aggregatedData}
                  columns={aggregatedColumns}
                  isLoading={isLoading}
                  emptyMessage="No aggregated data available"
                  globalFilter={aggregatedSearch}
                  onGlobalFilterChange={setAggregatedSearch}
                  hideSearch={true}
                />
              </Card>
            )}

            {individualRecords.length > 0 && (
              <Card className="overflow-visible">
                <CardHeader className="bg-muted/30 border-b flex-shrink-0">
                  <CardTitle>Individual Records</CardTitle>
                  <TableSearchBox
                    value={individualSearch}
                    onChange={setIndividualSearch}
                  />
                </CardHeader>
                <DataTable
                  data={individualRecords}
                  columns={individualColumns}
                  isLoading={isLoading}
                  emptyMessage="No individual records available"
                  globalFilter={individualSearch}
                  onGlobalFilterChange={setIndividualSearch}
                  hideSearch={true}
                />
              </Card>
            )}

            {!isLoading && aggregatedData.length === 0 && individualRecords.length === 0 && selectedPlayerIds.length > 0 && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    No data available for selected players. Click "Fetch Data" to load history
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default History;

