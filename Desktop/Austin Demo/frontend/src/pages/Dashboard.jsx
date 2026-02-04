import { useState, useEffect, useMemo } from 'react';
import { getDashboardData } from '../utils/api';
import DataTable from '../components/DataTable';
import TableSearchBox from '../components/TableSearchBox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { formatNumber } from '../utils/numberFormat';
import './Dashboard.css';

function Dashboard() {
  const [dashboardData, setDashboardData] = useState({
    tips_stats: { total_all_time: 0, previous_period: 0, since_last_thursday: 0 },
    blocked_players: [],
    over_credit_limit_players: [],
    agent_report: [],
    player_aggregates: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [blockedPlayersSearch, setBlockedPlayersSearch] = useState('');
  const [overCreditLimitSearch, setOverCreditLimitSearch] = useState('');
  const [agentReportSearch, setAgentReportSearch] = useState('');
  const [playerAggregatesSearch, setPlayerAggregatesSearch] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getDashboardData();
        setDashboardData(data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Failed to fetch dashboard data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const playerColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'credit_limit', header: 'Credit Limit', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? formatNumber(value) : 'N/A';
    }},
    { accessorKey: 'total_profit', header: 'Total Profit', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{formatNumber(value)}</span>;
    }},
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => formatNumber(info.getValue()) },
  ], []);

  const blockedPlayersColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'credit_limit', header: 'Credit Limit', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? formatNumber(value) : 'N/A';
    }},
    { accessorKey: 'notes', header: 'Notes' },
  ], []);

  const overCreditLimitColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'credit_limit', header: 'Credit Limit', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? formatNumber(value) : 'N/A';
    }},
    { accessorKey: 'weekly_credit_adjustment', header: 'Weekly Adjustment', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? formatNumber(value) : '0';
    }},
    { accessorKey: 'adjusted_credit_limit', header: 'Adjusted Credit Limit', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? formatNumber(value) : 'N/A';
    }},
    { accessorKey: 'period_profit', header: 'Profit Since Start of Week', cell: info => formatNumber(info.getValue()) },
  ], []);

  const agentColumns = useMemo(() => [
    { accessorKey: 'agent_id', header: 'Agent ID' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'total_profit', header: 'Total Profit', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{formatNumber(value)}</span>;
    }},
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => formatNumber(info.getValue()) },
    { accessorKey: 'agent_tips', header: 'Agent Tips', cell: info => formatNumber(info.getValue()) },
  ], []);


  return (
    <div className="w-full space-y-4" data-page-container style={{ minHeight: '1000px' }}>
      {error && (
        <div className="rounded-xl border-2 border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive shadow-sm w-full">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 flex-shrink-0">
        <Card className="h-[120px] flex flex-col">
          <CardHeader className="flex-1 flex flex-col justify-center">
            <CardDescription className="mb-2">Total Tips (All Time)</CardDescription>
            <CardTitle className="text-2xl font-bold leading-tight">
              {formatNumber(dashboardData.tips_stats.total_all_time)}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="h-[120px] flex flex-col">
          <CardHeader className="flex-1 flex flex-col justify-center">
            <CardDescription className="mb-2">Previous Week Tips</CardDescription>
            <CardTitle className="text-2xl font-bold leading-tight">
              {formatNumber(dashboardData.tips_stats.previous_period)}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="h-[120px] flex flex-col">
          <CardHeader className="flex-1 flex flex-col justify-center">
            <CardDescription className="mb-2">Since Start of Week</CardDescription>
            <CardTitle className="text-2xl font-bold leading-tight">
              {formatNumber(dashboardData.tips_stats.since_last_thursday)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {dashboardData.blocked_players?.length > 0 && (
        <Card className="overflow-hidden flex-shrink-0 border-2 border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="bg-red-100 dark:bg-red-900/30 border-b border-red-300 dark:border-red-700 flex-shrink-0">
            <CardTitle className="text-red-700 dark:text-red-300">Blocked Players (Do Not Allow)</CardTitle>
            <TableSearchBox
              value={blockedPlayersSearch}
              onChange={setBlockedPlayersSearch}
            />
          </CardHeader>
          <DataTable
            data={dashboardData.blocked_players || []}
            columns={blockedPlayersColumns}
            isLoading={isLoading}
            emptyMessage="No blocked players"
            globalFilter={blockedPlayersSearch}
            onGlobalFilterChange={setBlockedPlayersSearch}
            hideSearch={true}
          />
        </Card>
      )}

      {dashboardData.over_credit_limit_players?.length > 0 && (
        <Card className="overflow-hidden flex-shrink-0">
          <CardHeader className="bg-muted/30 border-b flex-shrink-0">
            <CardTitle>Players Over Credit Limit</CardTitle>
            <TableSearchBox
              value={overCreditLimitSearch}
              onChange={setOverCreditLimitSearch}
            />
          </CardHeader>
          <DataTable
            data={dashboardData.over_credit_limit_players}
            columns={overCreditLimitColumns}
            isLoading={isLoading}
            emptyMessage="No players over credit limit"
            globalFilter={overCreditLimitSearch}
            onGlobalFilterChange={setOverCreditLimitSearch}
            hideSearch={true}
          />
        </Card>
      )}

      <Card className="overflow-hidden flex-shrink-0">
        <CardHeader className="bg-muted/30 border-b flex-shrink-0">
          <CardTitle>Agent Report</CardTitle>
          <TableSearchBox
            value={agentReportSearch}
            onChange={setAgentReportSearch}
          />
          </CardHeader>
        <DataTable
          data={dashboardData.agent_report}
          columns={agentColumns}
          isLoading={isLoading}
          emptyMessage="No agent data available"
          globalFilter={agentReportSearch}
          onGlobalFilterChange={setAgentReportSearch}
          hideSearch={true}
        />
      </Card>

      <Card className="overflow-hidden flex-shrink-0">
        <CardHeader className="bg-muted/30 border-b flex-shrink-0">
          <CardTitle>Player Aggregates</CardTitle>
          <TableSearchBox
            value={playerAggregatesSearch}
            onChange={setPlayerAggregatesSearch}
          />
          </CardHeader>
        <DataTable
          data={dashboardData.player_aggregates}
          columns={playerColumns}
          isLoading={isLoading}
          emptyMessage="No player data available"
          globalFilter={playerAggregatesSearch}
          onGlobalFilterChange={setPlayerAggregatesSearch}
          hideSearch={true}
        />
      </Card>
    </div>
  );
}

export default Dashboard;
