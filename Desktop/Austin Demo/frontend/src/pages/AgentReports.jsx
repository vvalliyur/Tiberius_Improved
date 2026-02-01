import { useState, useEffect } from 'react';
import { getAgentReports } from '../utils/api';
import DataTable from '../components/DataTable';
import DateRangeFilter from '../components/DateRangeFilter';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import './AgentReport.css';
import './DetailedAgentReport.css';

function AgentReports() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lookbackDays, setLookbackDays] = useState(null);
  const [aggregatedData, setAggregatedData] = useState([]);
  const [detailedData, setDetailedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedAgents, setExpandedAgents] = useState(new Set());
  const [copiedAgentId, setCopiedAgentId] = useState(null);

  const aggregatedColumns = [
    { 
      accessorKey: 'agent_id', 
      header: 'Agent ID',
      cell: info => <div className="text-center">{info.getValue()}</div>
    },
    { 
      accessorKey: 'agent_name', 
      header: 'Agent Name',
      cell: info => <div className="text-center">{info.getValue()}</div>
    },
    {
      accessorKey: 'total_profit',
      header: 'Total Profit',
      cell: info => {
        const value = Number(info.getValue());
        return (
          <div className="text-center">
            <span className={value >= 0 ? 'profit-positive' : 'profit-negative'}>
              {value.toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'total_tips',
      header: 'Total Tips',
      cell: info => <div className="text-center">{Number(info.getValue()).toFixed(2)}</div>,
    },
    {
      accessorKey: 'agent_tips',
      header: 'Agent Tips',
      cell: info => <div className="text-center">{Number(info.getValue()).toFixed(2)}</div>,
    },
  ];

  const handleFetch = async () => {
    if (!startDate || !endDate) {
      setError('Please provide both start date and end date');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // lookbackDays always null - commented out feature
      const response = await getAgentReports(startDate || null, endDate || null, null);
      setAggregatedData(response.aggregated?.data || []);
      setDetailedData(response.detailed?.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch agent reports');
      setAggregatedData([]);
      setDetailedData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedByAgent = detailedData.reduce((acc, row) => {
    const agentId = row.agent_id;
    if (!acc[agentId]) {
      acc[agentId] = {
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        deal_percent: row.deal_percent,
        players: [],
        total_hands: 0,
        total_tips: 0,
        total_agent_tips: 0,
      };
    }
    acc[agentId].players.push({
      player_id: row.player_id,
      player_name: row.player_name,
      deal_percent: parseFloat(row.deal_percent || 0),
      total_hands: row.total_hands,
      total_tips: parseFloat(row.total_tips || 0),
      agent_tips: parseFloat(row.agent_tips || 0),
    });
    acc[agentId].total_hands += parseInt(row.total_hands || 0);
    acc[agentId].total_tips += parseFloat(row.total_tips || 0);
    acc[agentId].total_agent_tips += parseFloat(row.agent_tips || 0);
    return acc;
  }, {});

  const agents = Object.values(groupedByAgent);

  // Initialize all agents as expanded when data loads
  useEffect(() => {
    if (detailedData.length > 0) {
      const agentIds = [...new Set(detailedData.map(row => row.agent_id))];
      setExpandedAgents(new Set(agentIds));
    }
  }, [detailedData.length]); // Re-run when detailed data changes

  const toggleTable = (agentId) => {
    setExpandedAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  const copyTableToClipboard = async (agent) => {
    // Compact format: Player ID, Player Name, Deal %, Total Tips, Agent Tips
    const rows = agent.players.map(player => 
      `${player.player_id}, ${player.player_name || ''}, ${(player.deal_percent * 100).toFixed(2)}%, ${player.total_tips.toFixed(2)}, ${player.agent_tips.toFixed(2)}`
    );
    
    const totalsRow = `Total, , , ${agent.total_tips.toFixed(2)}, ${agent.total_agent_tips.toFixed(2)}`;
    
    const text = [...rows, totalsRow].join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAgentId(agent.agent_id);
      setTimeout(() => setCopiedAgentId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-2 h-[88px] flex flex-col justify-center">
        <h1 className="text-4xl font-bold tracking-tight">Agent Report</h1>
        <p className="text-lg text-muted-foreground">View aggregated and detailed agent performance reports</p>
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

      {aggregatedData.length > 0 && (
        <div className="agent-report-section">
          <h2 className="text-2xl font-semibold mb-4">Aggregated Report</h2>
          <div className="report-summary mb-4">
            <div className="summary-card">
              <div className="summary-label">Total Agents</div>
              <div className="summary-value">{aggregatedData.length}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total Agent Tips</div>
              <div className="summary-value">
                {aggregatedData.reduce((sum, row) => sum + Number(row.agent_tips || 0), 0).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="agent-report-table-wrapper">
            <DataTable
              data={aggregatedData}
              columns={aggregatedColumns}
              isLoading={isLoading}
              emptyMessage="No agent report data available. Adjust filters or upload game data"
            />
          </div>
        </div>
      )}

      {agents.length > 0 && (
        <div className="detailed-agent-report-section mt-8">
          <h2 className="text-2xl font-semibold mb-4">Detailed Report</h2>
          <div className="agents-container">
            {agents.map((agent) => {
              const isExpanded = expandedAgents.has(agent.agent_id);
              const rowCount = agent.players.length;
              
              return (
                <div key={agent.agent_id} className="agent-section">
                  <div className="agent-header">
                    <div className="agent-info">
                      <h3 className="text-2xl font-semibold m-0">{agent.agent_name}</h3>
                    </div>
                    <div className="agent-summary">
                      <div className="summary-item">
                        <span className="summary-label text-center">Players</span>
                        <span className="summary-value text-center">{agent.players.length}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label text-center">Total Tips</span>
                        <span className="summary-value text-center">{agent.total_tips.toFixed(2)}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label text-center">Agent Tips</span>
                        <span className="summary-value text-center highlight">{agent.total_agent_tips.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="agent-header-buttons">
                      <button
                        type="button"
                        onClick={() => toggleTable(agent.agent_id)}
                        className="header-action-button collapse-button"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyTableToClipboard(agent)}
                        className="header-action-button copy-button"
                      >
                        {copiedAgentId === agent.agent_id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="table-section">
                    <table className="players-table">
                      {isExpanded && (
                        <thead>
                          <tr>
                            <th>Player ID</th>
                            <th>Player Name</th>
                            <th>Deal %</th>
                            <th>Total Hands</th>
                            <th className="tips-header">Total Tips</th>
                            <th className="tips-header">Agent Tips</th>
                          </tr>
                        </thead>
                      )}
                      {isExpanded ? (
                        <tbody>
                          {agent.players.map((player) => (
                            <tr key={player.player_id}>
                              <td>{player.player_id}</td>
                              <td>{player.player_name}</td>
                              <td>{(player.deal_percent * 100).toFixed(2)}%</td>
                              <td>{player.total_hands.toLocaleString()}</td>
                              <td className="tips-cell">{player.total_tips.toFixed(2)}</td>
                              <td className="tips-cell">{player.agent_tips.toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="totals-row">
                            <td colSpan="4" className="totals-label">Total</td>
                            <td className="totals-value tips-cell">{agent.total_tips.toFixed(2)}</td>
                            <td className="totals-value tips-cell">{agent.total_agent_tips.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      ) : null}
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && aggregatedData.length === 0 && agents.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No agent report data available. Adjust filters or upload game data
        </div>
      )}
    </div>
  );
}

export default AgentReports;

