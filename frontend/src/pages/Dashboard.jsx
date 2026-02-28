import { useState, useEffect, useMemo } from 'react';
import { getDashboardData } from '../utils/api';
import DataTable from '../components/DataTable';
import TableSearchBox from '../components/TableSearchBox';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatNumber } from '../utils/numberFormat';
import { ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/button';

function SectionCard({ title, children, defaultExpanded = true, search, onSearchChange }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border py-3 px-5">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <div className="flex items-center gap-2">
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
    { accessorKey: 'agent_name', header: 'Agent' },
    { accessorKey: 'credit_limit', header: 'Credit Limit', cell: info => {
      const v = info.getValue();
      return v != null ? formatNumber(v) : 'N/A';
    }},
    { accessorKey: 'total_profit', header: 'Total Profit', cell: info => {
      const v = Number(info.getValue());
      return <span className={v >= 0 ? 'text-green-600 font-medium tabular-nums' : 'text-red-600 font-medium tabular-nums'}>{formatNumber(v)}</span>;
    }},
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => <span className="tabular-nums">{formatNumber(info.getValue())}</span> },
  ], []);

  const blockedPlayersColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_name', header: 'Agent' },
    { accessorKey: 'credit_limit', header: 'Credit Limit', cell: info => {
      const v = info.getValue();
      return v != null ? formatNumber(v) : 'N/A';
    }},
    { accessorKey: 'notes', header: 'Notes' },
  ], []);

  const overCreditLimitColumns = useMemo(() => [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_name', header: 'Agent' },
    { accessorKey: 'credit_limit', header: 'Credit Limit', cell: info => {
      const v = info.getValue();
      return v != null ? formatNumber(v) : 'N/A';
    }},
    { accessorKey: 'weekly_credit_adjustment', header: 'Weekly Adj.', cell: info => {
      const v = info.getValue();
      return v != null ? formatNumber(v) : '0';
    }},
    { accessorKey: 'adjusted_credit_limit', header: 'Adj. Limit', cell: info => {
      const v = info.getValue();
      return v != null ? formatNumber(v) : 'N/A';
    }},
    { accessorKey: 'period_profit', header: 'Profit (Week)', cell: info => <span className="tabular-nums">{formatNumber(info.getValue())}</span> },
  ], []);

  const agentColumns = useMemo(() => [
    { accessorKey: 'agent_id', header: 'Agent ID' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'total_profit', header: 'Total Profit', cell: info => {
      const v = Number(info.getValue());
      return <span className={v >= 0 ? 'text-green-600 font-medium tabular-nums' : 'text-red-600 font-medium tabular-nums'}>{formatNumber(v)}</span>;
    }},
    { accessorKey: 'total_tips', header: 'Total Tips', cell: info => <span className="tabular-nums">{formatNumber(info.getValue())}</span> },
    { accessorKey: 'agent_tips', header: 'Agent Tips', cell: info => <span className="tabular-nums">{formatNumber(info.getValue())}</span> },
  ], []);

  const getCurrentWeekRange = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const parts = formatter.formatToParts(now);
    const texasYear = parseInt(parts.find(p => p.type === 'year').value);
    const texasMonth = parseInt(parts.find(p => p.type === 'month').value) - 1;
    const texasDay = parseInt(parts.find(p => p.type === 'day').value);
    const texasHour = parseInt(parts.find(p => p.type === 'hour').value);
    const texasDate = new Date(texasYear, texasMonth, texasDay, texasHour);
    let daysSinceThursday = (texasDate.getDay() - 4) % 7;
    if (daysSinceThursday < 0) daysSinceThursday += 7;
    if (daysSinceThursday === 0 && texasHour < 12) daysSinceThursday = 7;
    const lastThursday = new Date(texasYear, texasMonth, texasDay - daysSinceThursday, 0, 0, 0);
    const todayTexas = new Date(texasYear, texasMonth, texasDay);
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(lastThursday)} – ${fmt(todayTexas)}`;
  };

  return (
    <div className="space-y-6" data-page-container>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your poker accounting data</p>
      </div>

      {error && (
        <div className="rounded-lg border-l-4 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="px-5 py-5">
                <div className="skeleton h-3 w-24 mb-3" />
                <div className="skeleton h-8 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="kpi-card-hover">
            <CardContent className="px-5 py-5">
              <p className="kpi-label">Total tips, all time</p>
              <p className="kpi-value">{formatNumber(dashboardData.tips_stats.total_all_time)}</p>
            </CardContent>
          </Card>
          <Card className="kpi-card-hover">
            <CardContent className="px-5 py-5">
              <p className="kpi-label">Previous week tips</p>
              <p className="kpi-value">{formatNumber(dashboardData.tips_stats.previous_period)}</p>
            </CardContent>
          </Card>
          <Card className="kpi-card-hover">
            <CardContent className="px-5 py-5">
              <p className="kpi-label">Since start of week</p>
              <p className="kpi-value">{formatNumber(dashboardData.tips_stats.since_last_thursday)}</p>
            </CardContent>
          </Card>
          <Card className="kpi-card-hover">
            <CardContent className="px-5 py-5">
              <p className="kpi-label">Current week</p>
              <p className="text-sm font-medium tracking-tight leading-snug mt-1">{getCurrentWeekRange()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Blocked Players */}
      {dashboardData.blocked_players?.length > 0 && (
        <Card className="overflow-hidden border-l-[3px] border-l-red-500">
          <CardHeader className="border-b border-border py-3 px-5">
            <CardTitle className="text-sm font-semibold text-red-600 dark:text-red-400">
              Blocked Players (Do Not Allow)
            </CardTitle>
            <div className="flex items-center gap-2">
              <TableSearchBox value={blockedPlayersSearch} onChange={setBlockedPlayersSearch} />
            </div>
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

      {/* Over Credit Limit */}
      {dashboardData.over_credit_limit_players?.length > 0 && (
        <SectionCard
          title="Players Over Credit Limit"
          search={overCreditLimitSearch}
          onSearchChange={setOverCreditLimitSearch}
        >
          <DataTable
            data={dashboardData.over_credit_limit_players}
            columns={overCreditLimitColumns}
            isLoading={isLoading}
            emptyMessage="No players over credit limit"
            globalFilter={overCreditLimitSearch}
            onGlobalFilterChange={setOverCreditLimitSearch}
            hideSearch={true}
          />
        </SectionCard>
      )}

      {/* Player Aggregates */}
      <SectionCard
        title="Player Aggregates"
        search={playerAggregatesSearch}
        onSearchChange={setPlayerAggregatesSearch}
      >
        <DataTable
          data={dashboardData.player_aggregates}
          columns={playerColumns}
          isLoading={isLoading}
          emptyMessage="No player data available"
          globalFilter={playerAggregatesSearch}
          onGlobalFilterChange={setPlayerAggregatesSearch}
          hideSearch={true}
        />
      </SectionCard>

      {/* Agent Report */}
      <SectionCard
        title="Agent Report"
        search={agentReportSearch}
        onSearchChange={setAgentReportSearch}
      >
        <DataTable
          data={dashboardData.agent_report}
          columns={agentColumns}
          isLoading={isLoading}
          emptyMessage="No agent data available"
          globalFilter={agentReportSearch}
          onGlobalFilterChange={setAgentReportSearch}
          hideSearch={true}
        />
      </SectionCard>
    </div>
  );
}

export default Dashboard;
