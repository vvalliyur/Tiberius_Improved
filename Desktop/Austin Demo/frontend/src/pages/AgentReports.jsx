import { useState, useEffect } from 'react';
import { getAgentReports, sendTelegramMessage } from '../utils/api';
import DataTable from '../components/DataTable';
import TableSearchBox from '../components/TableSearchBox';
import DateRangeFilter from '../components/DateRangeFilter';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { ChevronDown, ChevronUp, Copy, Check, Send } from 'lucide-react';
import './AgentReport.css';
import './DetailedAgentReport.css';

const formatDealPercent = (value) => {
  const percent = Number(value) * 100;
  const rounded = Math.round(percent * 100) / 100;
  return rounded % 1 === 0 ? `${rounded}%` : rounded.toFixed(2).replace(/\.?0+$/, '') + '%';
};

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
  const [sentTelegramAgentId, setSentTelegramAgentId] = useState(null);
  const [aggregatedSearch, setAggregatedSearch] = useState('');
  const [groupBy, setGroupBy] = useState('player_id'); // 'player_id' or 'real_name'
  const [detailedDataByRealName, setDetailedDataByRealName] = useState([]);

  const aggregatedColumns = [
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
      // Fetch both views in parallel
      const [responseByPlayerId, responseByRealName] = await Promise.all([
        getAgentReports(startDate || null, endDate || null, null, 'player_id'),
        getAgentReports(startDate || null, endDate || null, null, 'real_name')
      ]);
      
      setAggregatedData(responseByPlayerId.aggregated?.data || []);
      setDetailedData(responseByPlayerId.detailed?.data || []);
      setDetailedDataByRealName(responseByRealName.detailed?.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch agent reports');
      setAggregatedData([]);
      setDetailedData([]);
      setDetailedDataByRealName([]);
    } finally {
      setIsLoading(false);
    }
  };

  const processDetailedData = (data) => {
    return data.reduce((acc, row) => {
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
      
      // Handle both player_id grouping and real_name grouping
      if (row.real_name) {
        // Grouped by real_name
        acc[agentId].players.push({
          identifier: row.real_name,
          player_ids: row.player_ids || '',
          player_name: row.real_name,
          deal_percent: parseFloat(row.deal_percent || 0),
          total_hands: row.total_hands,
          total_tips: parseFloat(row.total_tips || 0),
          agent_tips: parseFloat(row.agent_tips || 0),
          isRealName: true,
        });
      } else {
        // Grouped by player_id
        acc[agentId].players.push({
          identifier: row.player_id,
          player_id: row.player_id,
          player_name: row.player_name,
          deal_percent: parseFloat(row.deal_percent || 0),
          total_hands: row.total_hands,
          total_tips: parseFloat(row.total_tips || 0),
          agent_tips: parseFloat(row.agent_tips || 0),
          isRealName: false,
        });
      }
      
      acc[agentId].total_hands += parseInt(row.total_hands || 0);
      acc[agentId].total_tips += parseFloat(row.total_tips || 0);
      acc[agentId].total_agent_tips += parseFloat(row.agent_tips || 0);
      return acc;
    }, {});
  };

  const currentDetailedData = groupBy === 'real_name' ? detailedDataByRealName : detailedData;
  const groupedByAgent = processDetailedData(currentDetailedData);
  const agents = Object.values(groupedByAgent);

  // Initialize all agents as expanded when data loads
  useEffect(() => {
    const dataToUse = groupBy === 'real_name' ? detailedDataByRealName : detailedData;
    if (dataToUse.length > 0) {
      const agentIds = [...new Set(dataToUse.map(row => row.agent_id))];
      setExpandedAgents(new Set(agentIds));
    }
  }, [detailedData.length, detailedDataByRealName.length, groupBy]); // Re-run when data or groupBy changes

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
    const rows = agent.players.map(player => {
      if (groupBy === 'real_name') {
        return `${player.player_name || ''}, ${player.player_ids || ''}, ${(player.deal_percent * 100).toFixed(2)}%, ${player.total_tips.toFixed(2)}, ${player.agent_tips.toFixed(2)}`;
      } else {
        return `${player.player_id || ''}, ${player.player_name || ''}, ${(player.deal_percent * 100).toFixed(2)}%, ${player.total_tips.toFixed(2)}, ${player.agent_tips.toFixed(2)}`;
      }
    });
    
    const totalsRow = `Total, , , ${agent.total_tips.toFixed(2)}, ${agent.total_agent_tips.toFixed(2)}`;
    
    const text = [...rows, totalsRow].join('\n');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAgentId(agent.agent_id);
      setTimeout(() => setCopiedAgentId(null), 2000);
    } catch (err) {
      // Error handled silently
    }
  };

  const sendToTelegram = async (agent) => {
    try {
      // Format the message similar to clipboard copy
      const rows = agent.players.map(player => {
        if (groupBy === 'real_name') {
          return `${player.player_name || ''}, ${player.player_ids || ''}, ${(player.deal_percent * 100).toFixed(2)}%, ${player.total_tips.toFixed(2)}, ${player.agent_tips.toFixed(2)}`;
        } else {
          return `${player.player_id || ''}, ${player.player_name || ''}, ${(player.deal_percent * 100).toFixed(2)}%, ${player.total_tips.toFixed(2)}, ${player.agent_tips.toFixed(2)}`;
        }
      });
      
      const totalsRow = `Total, , , ${agent.total_tips.toFixed(2)}, ${agent.total_agent_tips.toFixed(2)}`;
      
      const header = groupBy === 'real_name' 
        ? `Real Name, Player IDs, Deal %, Total Tips, Agent Tips`
        : `Player ID, Player Name, Deal %, Total Tips, Agent Tips`;
      
      const message = `<b>${agent.agent_name} - Agent Report</b>\n\n${header}\n${rows.join('\n')}\n${totalsRow}`;
      
      await sendTelegramMessage(agent.agent_id, message);
      setSentTelegramAgentId(agent.agent_id);
      setTimeout(() => setSentTelegramAgentId(null), 2000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send to Telegram');
    }
  };

  return (
    <div className="space-y-8 w-full">
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
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Aggregated Report</CardTitle>
            <TableSearchBox
              value={aggregatedSearch}
              onChange={setAggregatedSearch}
            />
          </CardHeader>
          <CardContent>
            <DataTable
              data={aggregatedData}
              columns={aggregatedColumns}
              isLoading={isLoading}
              emptyMessage="No agent report data available. Adjust filters or upload game data"
              globalFilter={aggregatedSearch}
              onGlobalFilterChange={setAggregatedSearch}
              hideSearch={true}
            />
            {/* Totals Row */}
            {aggregatedData.length > 0 && (() => {
              const totalProfit = aggregatedData.reduce((sum, row) => sum + (Number(row.total_profit) || 0), 0);
              const totalTips = aggregatedData.reduce((sum, row) => sum + (Number(row.total_tips) || 0), 0);
              
              return (
                <div className="mt-4 pt-4 border-t">
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full">
                      <tbody>
                        <tr className="border-b-0 bg-muted/30 font-semibold">
                          <td className="p-4 text-center">Total:</td>
                          <td className="p-4 text-center">
                            <span className={totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}>
                              {totalProfit.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {totalTips.toFixed(2)}
                          </td>
                          <td className="p-4 text-center">
                            {/* Empty cell for Agent Tips column alignment */}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {agents.length > 0 && (
        <div className="detailed-agent-report-section mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Detailed Report</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGroupBy('player_id')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  groupBy === 'player_id'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                By Player ID
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('real_name')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  groupBy === 'real_name'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                By Real Name
              </button>
            </div>
          </div>
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
                        title="Copy to clipboard"
                      >
                        {copiedAgentId === agent.agent_id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => sendToTelegram(agent)}
                        className="header-action-button telegram-button"
                        title="Send to Telegram"
                      >
                        {sentTelegramAgentId === agent.agent_id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="table-section">
                    <table className="players-table">
                      {isExpanded && (
                        <thead>
                          <tr>
                            {groupBy === 'real_name' ? (
                              <>
                                <th>Real Name</th>
                                <th>Player IDs</th>
                              </>
                            ) : (
                              <>
                                <th>Player ID</th>
                                <th>Player Name</th>
                              </>
                            )}
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
                            <tr key={player.identifier}>
                              {groupBy === 'real_name' ? (
                                <>
                                  <td>{player.player_name}</td>
                                  <td>{player.player_ids || player.identifier}</td>
                                </>
                              ) : (
                                <>
                                  <td>{player.player_id}</td>
                                  <td>{player.player_name}</td>
                                </>
                              )}
                              <td>{formatDealPercent(player.deal_percent)}</td>
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

