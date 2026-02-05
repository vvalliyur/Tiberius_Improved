import { useState, useEffect } from 'react';
import { getDataErrors } from '../utils/api';
import DataTable from '../components/DataTable';
import TableSearchBox from '../components/TableSearchBox';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, ChevronUp, ChevronDown } from 'lucide-react';
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
    <div className="space-y-8 w-full">
      {totalErrors === 0 && !errorsLoading && (
        <Card className="border-2 border-green-500/50">
          <CardContent className="p-8 text-center">
            <div className="text-green-600 dark:text-green-400 text-2xl font-semibold mb-2">
              ✓ No Data Quality Issues Found
            </div>
            <p className="text-muted-foreground">
              All players and agents are properly configured.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Data Quality Errors Section */}
      {totalErrors > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-destructive">
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
            <Card className="overflow-hidden border-2 border-destructive/50">
              <CardHeader className="bg-destructive/10 border-b">
                <CardTitle className="text-destructive">
                  Players in Games Not in Players Table ({dataErrors.players_in_games_not_in_players.count})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleTable('playersInGamesNotInPlayers')}
                    className="h-8 w-8 p-0"
                  >
                    {expandedTables.playersInGamesNotInPlayers ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
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
              {expandedTables.playersInGamesNotInPlayers && (
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
              )}
            </Card>
          )}

          {/* 2. Players in players table that are not mapped to agents */}
          {dataErrors.players_not_mapped_to_agents.count > 0 && (
            <Card className="overflow-hidden border-2 border-yellow-500/50">
              <CardHeader className="bg-yellow-100 dark:bg-yellow-900/30 border-b">
                <CardTitle className="text-yellow-700 dark:text-yellow-300">
                  Players Not Mapped to Agents ({dataErrors.players_not_mapped_to_agents.count})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleTable('playersNotMappedToAgents')}
                    className="h-8 w-8 p-0"
                  >
                    {expandedTables.playersNotMappedToAgents ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
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
              {expandedTables.playersNotMappedToAgents && (
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
              )}
            </Card>
          )}

          {/* 3. Agents that are not mapped to deal rules */}
          {dataErrors.agents_not_mapped_to_deal_rules.count > 0 && (
            <Card className="overflow-hidden border-2 border-orange-500/50">
              <CardHeader className="bg-orange-100 dark:bg-orange-900/30 border-b">
                <CardTitle className="text-orange-700 dark:text-orange-300">
                  Agents Not Mapped to Deal Rules ({dataErrors.agents_not_mapped_to_deal_rules.count})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleTable('agentsNotMappedToDealRules')}
                    className="h-8 w-8 p-0"
                  >
                    {expandedTables.agentsNotMappedToDealRules ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
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
              {expandedTables.agentsNotMappedToDealRules && (
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
              )}
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
