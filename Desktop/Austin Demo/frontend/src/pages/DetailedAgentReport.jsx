import { useState, useEffect, useMemo } from 'react';
import { getDetailedAgentReport } from '../utils/api';
import DateRangeFilter from '../components/DateRangeFilter';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { formatNumber } from '../utils/numberFormat';
import './DetailedAgentReport.css';

const formatDealPercent = (value) => {
  const percent = Number(value) * 100;
  const rounded = Math.round(percent * 100) / 100;
  return rounded % 1 === 0 ? `${rounded}%` : rounded.toFixed(2).replace(/\.?0+$/, '') + '%';
};

function DetailedAgentReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lookbackDays, setLookbackDays] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedAgents, setExpandedAgents] = useState(new Set());
  const [copiedAgentId, setCopiedAgentId] = useState(null);
  const [groupBy, setGroupBy] = useState('player_id'); // 'player_id' or 'real_name'
  const [reportDataByRealName, setReportDataByRealName] = useState([]);

  const handleFetch = async () => {
    if (!startDate || !endDate) {
      setError('Please provide both start date and end date');
      return;
    }

    setIsLoading(true);
    setError(null);
    setReportData([]); // Clear previous data
    setReportDataByRealName([]);
    try {
      // Fetch both views in parallel
      const [responseByPlayerId, responseByRealName] = await Promise.all([
        getDetailedAgentReport(startDate || null, endDate || null, null, 'player_id'),
        getDetailedAgentReport(startDate || null, endDate || null, null, 'real_name')
      ]);
      
      // Handle both response.data (if it's already the data) or response (if it's the full response object)
      let dataByPlayerId = [];
      if (Array.isArray(responseByPlayerId)) {
        dataByPlayerId = responseByPlayerId;
      } else if (responseByPlayerId && typeof responseByPlayerId === 'object') {
        dataByPlayerId = responseByPlayerId.data || [];
      }
      
      let dataByRealName = [];
      if (Array.isArray(responseByRealName)) {
        dataByRealName = responseByRealName;
      } else if (responseByRealName && typeof responseByRealName === 'object') {
        dataByRealName = responseByRealName.data || [];
      }
      
      setReportData(dataByPlayerId);
      setReportDataByRealName(dataByRealName);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch detailed agent report');
      setReportData([]);
      setReportDataByRealName([]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentReportData = groupBy === 'real_name' ? reportDataByRealName : reportData;

  const groupedByAgent = useMemo(() => {
    try {
      if (!Array.isArray(currentReportData) || currentReportData.length === 0) {
        return {};
      }
      
      return currentReportData.reduce((acc, row) => {
        try {
          if (!row || row.agent_id === null || row.agent_id === undefined) {
            return acc;
          }
          
          const agentId = row.agent_id;
          if (!acc[agentId]) {
            acc[agentId] = {
              agent_id: agentId,
              agent_name: row.agent_name || '',
              deal_percent: parseFloat(row.deal_percent || 0),
              players: [],
              total_hands: 0,
              total_tips: 0,
              total_agent_tips: 0,
            };
          }
          
          const totalHands = parseInt(row.total_hands || 0) || 0;
          const totalTips = parseFloat(row.total_tips || 0) || 0;
          const agentTips = parseFloat(row.agent_tips || 0) || 0;
          
          // Handle both player_id grouping and real_name grouping
          if (row.real_name) {
            // Grouped by real_name
            acc[agentId].players.push({
              identifier: row.real_name,
              player_ids: row.player_ids || '',
              player_name: row.real_name,
              deal_percent: parseFloat(row.deal_percent || 0),
              total_hands: totalHands,
              total_tips: totalTips,
              agent_tips: agentTips,
              isRealName: true,
            });
          } else {
            // Grouped by player_id
            acc[agentId].players.push({
              identifier: row.player_id || '',
              player_id: row.player_id || '',
              player_name: row.player_name || '',
              deal_percent: parseFloat(row.deal_percent || 0),
              total_hands: totalHands,
              total_tips: totalTips,
              agent_tips: agentTips,
              isRealName: false,
            });
          }
          
          acc[agentId].total_hands += totalHands;
          acc[agentId].total_tips += totalTips;
          acc[agentId].total_agent_tips += agentTips;
        } catch (rowErr) {
          // Error handled silently
        }
        return acc;
      }, {});
    } catch (err) {
      return {};
    }
  }, [currentReportData]);

  const agents = Object.values(groupedByAgent);

  // Initialize all agents as expanded when data loads
  useEffect(() => {
    const dataToUse = groupBy === 'real_name' ? reportDataByRealName : reportData;
    if (dataToUse.length > 0) {
      try {
        const agentIds = [...new Set(dataToUse.map(row => row?.agent_id).filter(Boolean))];
        setExpandedAgents(new Set(agentIds));
      } catch (err) {
        // Error handled silently
      }
    }
  }, [reportData, reportDataByRealName, groupBy]); // Re-run when report data or groupBy changes

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
    try {
      if (!agent || !Array.isArray(agent.players)) {
        return;
      }
      
      // Compact format: Player ID, Player Name, Deal %, Total Tips, Agent Tips
      const rows = agent.players.map(player => {
        if (!player) return '';
        const dealPercent = typeof player.deal_percent === 'number' ? player.deal_percent : 0;
        const totalTips = typeof player.total_tips === 'number' ? player.total_tips : 0;
        const agentTips = typeof player.agent_tips === 'number' ? player.agent_tips : 0;
        if (groupBy === 'real_name') {
          return `${player.player_name || ''}, ${player.player_ids || ''}, ${formatDealPercent(dealPercent)}, ${formatNumber(totalTips)}, ${formatNumber(agentTips)}`;
        } else {
          return `${player.player_id || ''}, ${player.player_name || ''}, ${formatDealPercent(dealPercent)}, ${formatNumber(totalTips)}, ${formatNumber(agentTips)}`;
        }
      }).filter(Boolean);
      
      const totalTips = typeof agent.total_tips === 'number' ? agent.total_tips : 0;
      const totalAgentTips = typeof agent.total_agent_tips === 'number' ? agent.total_agent_tips : 0;
      const totalsRow = `Total, , , ${formatNumber(totalTips)}, ${formatNumber(totalAgentTips)}`;
      
      const text = [...rows, totalsRow].join('\n');
      
      await navigator.clipboard.writeText(text);
      setCopiedAgentId(agent.agent_id);
      setTimeout(() => setCopiedAgentId(null), 2000);
    } catch (err) {
      // Error handled silently
    }
  };

  return (
    <div className="detailed-agent-report-page">
      <div className="page-header">
        <div className="flex items-center justify-between">
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
        <div className="error-message">{error}</div>
      )}

      {isLoading ? (
        <div className="loading-message">Loading report...</div>
      ) : agents.length > 0 ? (
        <div className="agents-container">
          {agents.map((agent) => {
            try {
              if (!agent || agent.agent_id === null || agent.agent_id === undefined) {
                return null;
              }
              
              const isExpanded = expandedAgents.has(agent.agent_id);
              const players = Array.isArray(agent.players) ? agent.players : [];
              
              return (
                <div key={agent.agent_id} className="agent-section">
                <div className="agent-header">
                  <div className="agent-info">
                    <h2 className="m-0 text-2xl font-semibold">{agent.agent_name}</h2>
                  </div>
                  <div className="agent-summary">
                    <div className="summary-item">
                      <span className="summary-label text-center">Players</span>
                      <span className="summary-value text-center">{players.length}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label text-center">Total Tips</span>
                      <span className="summary-value text-center tips-value">{typeof agent.total_tips === 'number' ? formatNumber(agent.total_tips) : '0'}</span>
                    </div>
                    <div className="summary-item tips-summary">
                      <span className="summary-label text-center">Agent Tips</span>
                      <span className="summary-value text-center highlight agent-tips-value">{typeof agent.total_agent_tips === 'number' ? formatNumber(agent.total_agent_tips) : '0'}</span>
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

                <div className="agent-actions-container">
                  <button
                    type="button"
                    onClick={() => toggleTable(agent.agent_id)}
                    className="action-button collapse-button"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Collapse Table
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Expand Table
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyTableToClipboard(agent)}
                    className="action-button copy-button"
                  >
                    {copiedAgentId === agent.agent_id ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Table
                      </>
                    )}
                  </button>
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
                        {players.map((player) => {
                          if (!player) return null;
                          const dealPercent = typeof player.deal_percent === 'number' ? player.deal_percent : 0;
                          const totalTips = typeof player.total_tips === 'number' ? player.total_tips : 0;
                          const agentTips = typeof player.agent_tips === 'number' ? player.agent_tips : 0;
                          return (
                            <tr key={player.identifier || Math.random()}>
                              {groupBy === 'real_name' ? (
                                <>
                                  <td>{player.player_name || ''}</td>
                                  <td>{player.player_ids || player.identifier || ''}</td>
                                </>
                              ) : (
                                <>
                                  <td>{player.player_id || ''}</td>
                                  <td>{player.player_name || ''}</td>
                                </>
                              )}
                              <td>{formatDealPercent(dealPercent)}</td>
                              <td>{typeof player.total_hands === 'number' ? player.total_hands.toLocaleString() : (player.total_hands || 0)}</td>
                              <td className="tips-cell">{formatNumber(totalTips)}</td>
                              <td className="tips-cell">{formatNumber(agentTips)}</td>
                            </tr>
                          );
                        })}
                        <tr className="totals-row">
                          <td colSpan="4" className="totals-label">Total</td>
                          <td className="totals-value tips-cell">{typeof agent.total_tips === 'number' ? formatNumber(agent.total_tips) : '0'}</td>
                          <td className="totals-value tips-cell">{typeof agent.total_agent_tips === 'number' ? formatNumber(agent.total_agent_tips) : '0'}</td>
                        </tr>
                      </tbody>
                    ) : null}
                  </table>
                </div>
              </div>
              );
            } catch (agentErr) {
              return (
                <div key={agent?.agent_id || `error-${Math.random()}`} className="agent-section">
                  <div className="error-message">Error rendering agent data: {agentErr.message}</div>
                </div>
              );
            }
          })}
        </div>
      ) : (
        <div className="empty-message">
          No detailed agent report data available. Adjust filters or upload game data
        </div>
      )}
    </div>
  );
}

export default DetailedAgentReport;
