import { useState, useEffect } from 'react';
import { getDataErrors } from '../utils/api';
import DataTable from '../components/DataTable';
import TableSearchBox from '../components/TableSearchBox';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, ChevronDown } from 'lucide-react';
import { downloadDataErrors, downloadAllDataErrors } from '../utils/csvExport';
import { formatNumber } from '../utils/numberFormat';

function Check() {
  const [dataErrors, setDataErrors] = useState({
    players_in_games_not_in_players: { data: [], count: 0 },
    players_not_mapped_to_agents: { data: [], count: 0 },
    agents_not_mapped_to_deal_rules: { data: [], count: 0 }
  });
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [missingPlayersSearch, setMissingPlayersSearch] = useState('');
  const [unmappedPlayersSearch, setUnmappedPlayersSearch] = useState('');
  const [unmappedAgentsSearch, setUnmappedAgentsSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState({
    playersInGamesNotInPlayers: true,
    playersNotMappedToAgents: true,
    agentsNotMappedToDealRules: true
  });

  useEffect(() => {
    const fetchDataErrors = async () => {
      setErrorsLoading(true);
      try {
        const errors = await getDataErrors();
        setDataErrors(errors);
      } catch (err) {
        // Error handled silently
      } finally {
        setErrorsLoading(false);
      }
    };
    fetchDataErrors();
  }, []);

  const totalErrors = 
    dataErrors.players_in_games_not_in_players.count +
    dataErrors.players_not_mapped_to_agents.count +
    dataErrors.agents_not_mapped_to_deal_rules.count;

  const toggleTable = (tableKey) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableKey]: !prev[tableKey]
    }));
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Check</h1>
        <p className="text-sm text-muted-foreground mt-1">Data quality and integrity checks</p>
      </div>

      {totalErrors === 0 && !errorsLoading && (
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="px-6 py-10 text-center">
            <div className="flex justify-center mb-3">
              <svg className="check-icon-animated" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'hsl(var(--chart-2))' }}>
                <circle cx="12" cy="12" r="10" opacity="0.2" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div className="text-green-600 dark:text-green-400 text-lg font-semibold mb-1">
              No Data Quality Issues Found
            </div>
            <p className="text-sm text-muted-foreground">
              All players and agents are properly configured.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Data Quality Errors Section */}
      {totalErrors > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-destructive">
              Data Quality Errors ({totalErrors} total)
            </h2>
            <Button
              onClick={() => downloadAllDataErrors(dataErrors, {})}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download All as CSV
            </Button>
          </div>
          
          {/* 1. Players in games table that are not in players table */}
          {dataErrors.players_in_games_not_in_players.count > 0 && (
            <Card className="overflow-hidden border-l-4 border-l-destructive">
              <CardHeader className="border-b">
                <CardTitle className="text-destructive text-sm">
                  Players in Games Not in Players Table ({dataErrors.players_in_games_not_in_players.count})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleTable('playersInGamesNotInPlayers')}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronDown className={`h-4 w-4 collapse-chevron ${expandedTables.playersInGamesNotInPlayers ? 'open' : ''}`} />
                  </Button>
                  <Button
                    onClick={() => downloadDataErrors(
                      dataErrors,
                      'players_in_games_not_in_players',
                      [
                        { accessorKey: 'player_id', header: 'Player ID' },
                        { accessorKey: 'player_name', header: 'Player Name' },
                        { accessorKey: 'game_count', header: 'Game Count' },
                        { accessorKey: 'total_tips', header: 'Total Tips' },
                      ]
                    )}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </Button>
                  <TableSearchBox
                    value={missingPlayersSearch}
                    onChange={setMissingPlayersSearch}
                  />
                </div>
              </CardHeader>
              <div className={`collapsible-wrapper ${expandedTables.playersInGamesNotInPlayers ? 'open' : ''}`}>
                <div className="collapsible-inner">
                  <DataTable
                    data={dataErrors.players_in_games_not_in_players.data}
                    columns={[
                      { accessorKey: 'player_id', header: 'Player ID' },
                      { accessorKey: 'player_name', header: 'Player Name' },
                      { accessorKey: 'game_count', header: 'Game Count' },
                      {
                        accessorKey: 'total_tips',
                        header: 'Total Tips',
                        cell: info => formatNumber(info.getValue())
                      },
                    ]}
                    isLoading={errorsLoading}
                    emptyMessage="No players in games not in players table"
                    globalFilter={missingPlayersSearch}
                    onGlobalFilterChange={setMissingPlayersSearch}
                    hideSearch={true}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* 2. Players in players table that are not mapped to agents */}
          {dataErrors.players_not_mapped_to_agents.count > 0 && (
            <Card className="overflow-hidden border-l-4 border-l-yellow-500">
              <CardHeader className="border-b">
                <CardTitle className="text-yellow-700 dark:text-yellow-300 text-sm">
                  Players Not Mapped to Agents ({dataErrors.players_not_mapped_to_agents.count})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleTable('playersNotMappedToAgents')}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronDown className={`h-4 w-4 collapse-chevron ${expandedTables.playersNotMappedToAgents ? 'open' : ''}`} />
                  </Button>
                  <Button
                    onClick={() => downloadDataErrors(
                      dataErrors,
                      'players_not_mapped_to_agents',
                      [
                        { accessorKey: 'player_id', header: 'Player ID' },
                        { accessorKey: 'player_name', header: 'Player Name' },
                        { accessorKey: 'agent_id', header: 'Agent ID' },
                        { accessorKey: 'error_description', header: 'Issue' },
                      ]
                    )}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </Button>
                  <TableSearchBox
                    value={unmappedPlayersSearch}
                    onChange={setUnmappedPlayersSearch}
                  />
                </div>
              </CardHeader>
              <div className={`collapsible-wrapper ${expandedTables.playersNotMappedToAgents ? 'open' : ''}`}>
                <div className="collapsible-inner">
                  <DataTable
                    data={dataErrors.players_not_mapped_to_agents.data}
                    columns={[
                      { accessorKey: 'player_id', header: 'Player ID' },
                      { accessorKey: 'player_name', header: 'Player Name' },
                      {
                        accessorKey: 'agent_id',
                        header: 'Agent ID',
                        cell: info => {
                          const value = info.getValue();
                          return value !== null && value !== undefined ? value : 'N/A';
                        }
                      },
                      { accessorKey: 'error_description', header: 'Issue' },
                    ]}
                    isLoading={errorsLoading}
                    emptyMessage="No players without agent mappings"
                    globalFilter={unmappedPlayersSearch}
                    onGlobalFilterChange={setUnmappedPlayersSearch}
                    hideSearch={true}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* 3. Agents that are not mapped to deal rules */}
          {dataErrors.agents_not_mapped_to_deal_rules.count > 0 && (
            <Card className="overflow-hidden border-l-4 border-l-orange-500">
              <CardHeader className="border-b">
                <CardTitle className="text-orange-700 dark:text-orange-300 text-sm">
                  Agents Not Mapped to Deal Rules ({dataErrors.agents_not_mapped_to_deal_rules.count})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleTable('agentsNotMappedToDealRules')}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronDown className={`h-4 w-4 collapse-chevron ${expandedTables.agentsNotMappedToDealRules ? 'open' : ''}`} />
                  </Button>
                  <Button
                    onClick={() => downloadDataErrors(
                      dataErrors,
                      'agents_not_mapped_to_deal_rules',
                      [
                        { accessorKey: 'agent_id', header: 'Agent ID' },
                        { accessorKey: 'agent_name', header: 'Agent Name' },
                        { accessorKey: 'default_deal_percent', header: 'Default Deal %' },
                        { accessorKey: 'rule_count', header: 'Rule Count' },
                      ]
                    )}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download CSV
                  </Button>
                  <TableSearchBox
                    value={unmappedAgentsSearch}
                    onChange={setUnmappedAgentsSearch}
                  />
                </div>
              </CardHeader>
              <div className={`collapsible-wrapper ${expandedTables.agentsNotMappedToDealRules ? 'open' : ''}`}>
                <div className="collapsible-inner">
                  <DataTable
                    data={dataErrors.agents_not_mapped_to_deal_rules.data}
                    columns={[
                      { accessorKey: 'agent_id', header: 'Agent ID' },
                      { accessorKey: 'agent_name', header: 'Agent Name' },
                      {
                        accessorKey: 'default_deal_percent',
                        header: 'Default Deal %',
                        cell: info => {
                          const value = info.getValue();
                          if (value === null || value === undefined) return 'N/A';
                          const percent = Number(value) * 100;
                          const rounded = Math.round(percent * 100) / 100;
                          return rounded % 1 === 0 ? `${rounded}%` : rounded.toFixed(2).replace(/\.?0+$/, '') + '%';
                        }
                      },
                      { accessorKey: 'rule_count', header: 'Rule Count' },
                    ]}
                    isLoading={errorsLoading}
                    emptyMessage="No agents without deal rules"
                    globalFilter={unmappedAgentsSearch}
                    onGlobalFilterChange={setUnmappedAgentsSearch}
                    hideSearch={true}
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {errorsLoading && (
        <div className="text-center text-muted-foreground py-12">
          Loading data quality checks...
        </div>
      )}
    </div>
  );
}

export default Check;
