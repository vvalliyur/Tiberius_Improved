import { useState, useEffect, useMemo } from 'react';
import { getDashboardData } from '../utils/api';
import DataTable from '../components/DataTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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
      return value !== null && value !== undefined ? Number(value).toFixed(2) : 'N/A';
    }},
    { accessorKey: 'total_profit', header: 'Total Profit', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{value.toFixed(2)}</span>;
    }},
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => Number(info.getValue()).toFixed(2) },
  ], []);

  const blockedPlayersColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'credit_limit', header: 'Credit Limit', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? Number(value).toFixed(2) : 'N/A';
    }},
    { accessorKey: 'comm_channel', header: 'Comm Channel' },
    { accessorKey: 'notes', header: 'Notes' },
  ], []);

  const overCreditLimitColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'credit_limit', header: 'Credit Limit', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? Number(value).toFixed(2) : 'N/A';
    }},
    { accessorKey: 'weekly_credit_adjustment', header: 'Weekly Adjustment', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? Number(value).toFixed(2) : '0.00';
    }},
    { accessorKey: 'adjusted_credit_limit', header: 'Adjusted Credit Limit', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? Number(value).toFixed(2) : 'N/A';
    }},
    { accessorKey: 'period_profit', header: 'Profit Since Start of Week', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{value.toFixed(2)}</span>;
    }},
  ], []);

  const agentColumns = useMemo(() => [
    { accessorKey: 'agent_id', header: 'Agent ID' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'total_profit', header: 'Total Profit', cell: info => {
      const value = Number(info.getValue());
      return <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{value.toFixed(2)}</span>;
    }},
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => Number(info.getValue()).toFixed(2) },
    { accessorKey: 'agent_tips', header: 'Agent Tips', cell: info => Number(info.getValue()).toFixed(2) },
  ], []);

  const getRowClassName = (row) => {
    if (row.original.is_below_credit) {
      return 'bg-red-100 dark:bg-red-900/20';
    }
    return '';
  };

  return (
    <div className="w-full" data-page-container style={{ minHeight: '1000px' }}>
      <div className="flex-shrink-0 mb-2">
        <h1 className="text-4xl font-bold tracking-tight mb-0">Dashboard</h1>
      </div>

      <div className="min-h-[60px] flex items-center flex-shrink-0 mb-4">
        {error && (
          <div className="rounded-xl border-2 border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive shadow-sm w-full">
            {error}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3 flex-shrink-0 mb-6">
        <Card className="h-[120px] flex flex-col">
          <CardHeader className="flex-1 flex flex-col justify-center">
            <CardDescription className="mb-2">Total Tips (All Time)</CardDescription>
            <CardTitle className="text-2xl font-bold leading-tight">
              {dashboardData.tips_stats.total_all_time.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="h-[120px] flex flex-col">
          <CardHeader className="flex-1 flex flex-col justify-center">
            <CardDescription className="mb-2">Previous Week Tips</CardDescription>
            <CardTitle className="text-2xl font-bold leading-tight">
              {dashboardData.tips_stats.previous_period.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="h-[120px] flex flex-col">
          <CardHeader className="flex-1 flex flex-col justify-center">
            <CardDescription className="mb-2">Since Start of Week</CardDescription>
            <CardTitle className="text-2xl font-bold leading-tight">
              {dashboardData.tips_stats.since_last_thursday.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {dashboardData.blocked_players?.length > 0 && (
        <Card className="overflow-hidden flex-shrink-0 mt-6">
          <CardHeader className="bg-muted/30 border-b flex-shrink-0">
            <CardTitle className="text-2xl">Blocked Players</CardTitle>
            <CardDescription className="text-base">
              {dashboardData.blocked_players.length} blocked {dashboardData.blocked_players.length === 1 ? 'player' : 'players'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-shrink-0">
            <DataTable
              data={dashboardData.blocked_players}
              columns={blockedPlayersColumns}
              isLoading={isLoading}
              emptyMessage="No blocked players"
            />
          </CardContent>
        </Card>
      )}

      {dashboardData.over_credit_limit_players?.length > 0 && (
        <Card className="overflow-hidden flex-shrink-0 mt-6">
          <CardHeader className="bg-muted/30 border-b flex-shrink-0">
            <CardTitle className="text-2xl">Players Over Credit Limit</CardTitle>
            <CardDescription className="text-base">
              {dashboardData.over_credit_limit_players.length} {dashboardData.over_credit_limit_players.length === 1 ? 'player' : 'players'} over limit
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex-shrink-0">
            <DataTable
              data={dashboardData.over_credit_limit_players}
              columns={overCreditLimitColumns}
              isLoading={isLoading}
              emptyMessage="No players over credit limit"
            />
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden flex-shrink-0 mt-6">
        <CardHeader className="bg-muted/30 border-b flex-shrink-0">
          <CardTitle className="text-2xl">Agent Report</CardTitle>
          <CardDescription className="text-base">
            {dashboardData.agent_report.length} agents
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex-shrink-0">
          <DataTable
            data={dashboardData.agent_report}
            columns={agentColumns}
            isLoading={isLoading}
            emptyMessage="No agent data available"
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden flex-shrink-0 mt-6">
        <CardHeader className="bg-muted/30 border-b flex-shrink-0">
          <CardTitle className="text-2xl">Player Aggregates</CardTitle>
          <CardDescription className="text-base">
            {dashboardData.player_aggregates.length} players
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex-shrink-0">
          <DataTable
            data={dashboardData.player_aggregates}
            columns={playerColumns}
            isLoading={isLoading}
            emptyMessage="No player data available"
            getRowClassName={getRowClassName}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
