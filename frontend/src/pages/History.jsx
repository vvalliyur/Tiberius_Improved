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
import { ChevronDown } from 'lucide-react';

function SectionCard({ title, children, defaultExpanded = true, search, onSearchChange, headerContent }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border py-3 px-5">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {headerContent}
          {search !== undefined && (
            <TableSearchBox value={search} onChange={onSearchChange} />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(v => !v)}
            className="h-7 w-7"
          >
            <ChevronDown className={`h-4 w-4 collapse-chevron ${expanded ? 'open' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <div className={`collapsible-wrapper ${expanded ? 'open' : ''}`}>
        <div className="collapsible-inner">
          {children}
        </div>
      </div>
    </Card>
  );
}

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
  const [sourceCsvs, setSourceCsvs] = useState([]);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
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
      setSourceCsvs(response.source_csvs || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch player history');
      setAggregatedData([]);
      setIndividualRecords([]);
      setSourceCsvs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const aggregatedColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'game_count', header: 'Games Played', cell: info => formatNumber(info.getValue() || 0) },
    { accessorKey: 'total_hands', header: 'Total Hands', cell: info => formatNumber(info.getValue() || 0) },
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
    <div className="w-full" data-page-container style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground mt-1">Player session history and aggregated statistics</p>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:gap-6" style={{ minHeight: 'calc(100vh - 10rem)' }}>
        <div className="md:w-80 md:flex-shrink-0 md:min-w-[320px] md:max-w-[320px]">
          {/* Mobile toggle header */}
          <button
            className="md:hidden w-full flex items-center justify-between px-4 py-2.5 mb-2 rounded-[0.625rem] border border-border bg-card text-sm font-medium card-shadow"
            onClick={() => setIsPanelOpen(v => !v)}
          >
            <span>Select Players{selectedCount > 0 ? ` (${selectedCount} selected)` : ''}</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: isPanelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
              <path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className={`${isPanelOpen ? 'block' : 'hidden'} md:block md:h-[calc(100vh-10rem)]`}>
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b flex-shrink-0">
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
              <div className="rounded-lg border-l-4 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <div ref={mainContentRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
            {sourceCsvs.length > 0 && (
              <SectionCard
                title={`${sourceCsvs.length} ${sourceCsvs.length === 1 ? 'CSV processed' : 'CSVs processed'}`}
                defaultExpanded={false}
              >
                <CardContent className="pt-3 pb-3">
                  <div className="flex flex-wrap gap-2">
                    {sourceCsvs.map((csv) => (
                      <div
                        key={csv.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs font-medium"
                      >
                        <span className="text-foreground">{csv.filename}</span>
                        <span className="text-muted-foreground">({csv.game_code})</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </SectionCard>
            )}

            {aggregatedData.length > 0 && (
              <SectionCard
                title="Aggregated Statistics"
                search={aggregatedSearch}
                onSearchChange={setAggregatedSearch}
              >
                <DataTable
                  data={aggregatedData}
                  columns={aggregatedColumns}
                  isLoading={isLoading}
                  emptyMessage="No aggregated data available"
                  globalFilter={aggregatedSearch}
                  onGlobalFilterChange={setAggregatedSearch}
                  hideSearch={true}
                />
              </SectionCard>
            )}

            {individualRecords.length > 0 && (
              <SectionCard
                title="Individual Records"
                search={individualSearch}
                onSearchChange={setIndividualSearch}
              >
                <DataTable
                  data={individualRecords}
                  columns={individualColumns}
                  isLoading={isLoading}
                  emptyMessage="No individual records available"
                  globalFilter={individualSearch}
                  onGlobalFilterChange={setIndividualSearch}
                  hideSearch={true}
                />
              </SectionCard>
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

