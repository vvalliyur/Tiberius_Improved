import { useState, useEffect, useMemo } from 'react';
import { getDetailedAgentReport } from '../utils/api';
import DateRangeFilter from '../components/DateRangeFilter';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import './DetailedAgentReport.css';

function DetailedAgentReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lookbackDays, setLookbackDays] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedAgents, setExpandedAgents] = useState(new Set());
  const [copiedAgentId, setCopiedAgentId] = useState(null);

  const handleFetch = async () => {
    if (!startDate || !endDate) {
      setError('Please provide both start date and end date');
      return;
    }

    setIsLoading(true);
    setError(null);
    setReportData([]); // Clear previous data
    try {
      // lookbackDays always null - commented out feature
      const response = await getDetailedAgentReport(startDate || null, endDate || null, null);
      console.log('Detailed agent report response:', response);
      
      // Handle both response.data (if it's already the data) or response (if it's the full response object)
      let data = [];
      if (Array.isArray(response)) {
        data = response;
      } else if (response && typeof response === 'object') {
        data = response.data || [];
      }
      
      console.log('Processed data:', data);
      setReportData(data);
    } catch (err) {
      console.error('Error fetching detailed agent report:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        stack: err.stack
      });
      setError(err.response?.data?.detail || err.message || 'Failed to fetch detailed agent report');
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedByAgent = useMemo(() => {
    try {
      if (!Array.isArray(reportData) || reportData.length === 0) {
        return {};
      }
      
      return reportData.reduce((acc, row) => {
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
          
          acc[agentId].players.push({
            player_id: row.player_id || '',
            player_name: row.player_name || '',
            deal_percent: parseFloat(row.deal_percent || 0),
            total_hands: totalHands,
            total_tips: totalTips,
            agent_tips: agentTips,
          });
          
          acc[agentId].total_hands += totalHands;
          acc[agentId].total_tips += totalTips;
          acc[agentId].total_agent_tips += agentTips;
        } catch (rowErr) {
          console.error('Error processing row:', rowErr, row);
        }
        return acc;
      }, {});
    } catch (err) {
      console.error('Error grouping agent data:', err, reportData);
      return {};
    }
  }, [reportData]);

  const agents = Object.values(groupedByAgent);

  // Initialize all agents as expanded when data loads
  useEffect(() => {
    if (reportData.length > 0) {
      try {
        const agentIds = [...new Set(reportData.map(row => row?.agent_id).filter(Boolean))];
        setExpandedAgents(new Set(agentIds));
      } catch (err) {
        console.error('Error initializing expanded agents:', err);
      }
    }
  }, [reportData]); // Re-run when report data changes

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
        console.error('Invalid agent data for copy:', agent);
        return;
      }
      
      // Compact format: Player ID, Player Name, Deal %, Total Tips, Agent Tips
      const rows = agent.players.map(player => {
        if (!player) return '';
        const dealPercent = typeof player.deal_percent === 'number' ? player.deal_percent : 0;
        const totalTips = typeof player.total_tips === 'number' ? player.total_tips : 0;
        const agentTips = typeof player.agent_tips === 'number' ? player.agent_tips : 0;
        return `${player.player_id || ''}, ${player.player_name || ''}, ${(dealPercent * 100).toFixed(2)}%, ${totalTips.toFixed(2)}, ${agentTips.toFixed(2)}`;
      }).filter(Boolean);
      
      const totalTips = typeof agent.total_tips === 'number' ? agent.total_tips : 0;
      const totalAgentTips = typeof agent.total_agent_tips === 'number' ? agent.total_agent_tips : 0;
      const totalsRow = `Total, , , ${totalTips.toFixed(2)}, ${totalAgentTips.toFixed(2)}`;
      
      const text = [...rows, totalsRow].join('\n');
      
      await navigator.clipboard.writeText(text);
      setCopiedAgentId(agent.agent_id);
      setTimeout(() => setCopiedAgentId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="detailed-agent-report-page">
      <div className="page-header">
        <h1>Detailed Agent Report</h1>
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
                      <span className="summary-value text-center tips-value">{typeof agent.total_tips === 'number' ? agent.total_tips.toFixed(2) : '0.00'}</span>
                    </div>
                    <div className="summary-item tips-summary">
                      <span className="summary-label text-center">Agent Tips</span>
                      <span className="summary-value text-center highlight agent-tips-value">{typeof agent.total_agent_tips === 'number' ? agent.total_agent_tips.toFixed(2) : '0.00'}</span>
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
                        {players.map((player) => {
                          if (!player) return null;
                          const dealPercent = typeof player.deal_percent === 'number' ? player.deal_percent : 0;
                          const totalTips = typeof player.total_tips === 'number' ? player.total_tips : 0;
                          const agentTips = typeof player.agent_tips === 'number' ? player.agent_tips : 0;
                          return (
                            <tr key={player.player_id || Math.random()}>
                              <td>{player.player_id || ''}</td>
                              <td>{player.player_name || ''}</td>
                              <td>{(dealPercent * 100).toFixed(2)}%</td>
                              <td>{typeof player.total_hands === 'number' ? player.total_hands.toLocaleString() : (player.total_hands || 0)}</td>
                              <td className="tips-cell">{totalTips.toFixed(2)}</td>
                              <td className="tips-cell">{agentTips.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                        <tr className="totals-row">
                          <td colSpan="4" className="totals-label">Total</td>
                          <td className="totals-value tips-cell">{typeof agent.total_tips === 'number' ? agent.total_tips.toFixed(2) : '0.00'}</td>
                          <td className="totals-value tips-cell">{typeof agent.total_agent_tips === 'number' ? agent.total_agent_tips.toFixed(2) : '0.00'}</td>
                        </tr>
                      </tbody>
                    ) : null}
                  </table>
                </div>
              </div>
              );
            } catch (agentErr) {
              console.error('Error rendering agent:', agentErr, agent);
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
