import { useState, useEffect } from 'react';
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
    try {
      // lookbackDays always null - commented out feature
      const response = await getDetailedAgentReport(startDate || null, endDate || null, null);
      setReportData(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch detailed agent report');
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedByAgent = reportData.reduce((acc, row) => {
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
    if (reportData.length > 0) {
      const agentIds = [...new Set(reportData.map(row => row.agent_id))];
      setExpandedAgents(new Set(agentIds));
    }
  }, [reportData.length]); // Re-run when report data changes

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

      {error && <div className="error-message">{error}</div>}

      {isLoading ? (
        <div className="loading-message">Loading report...</div>
      ) : agents.length > 0 ? (
        <div className="agents-container">
          {agents.map((agent) => {
            const isExpanded = expandedAgents.has(agent.agent_id);
            const rowCount = agent.players.length;
            
            return (
              <div key={agent.agent_id} className="agent-section">
                <div className="agent-header">
                  <div className="agent-info">
                    <h2 className="m-0 text-2xl font-semibold">{agent.agent_name}</h2>
                  </div>
                  <div className="agent-summary">
                    <div className="summary-item">
                      <span className="summary-label text-center">Players</span>
                      <span className="summary-value text-center">{agent.players.length}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label text-center">Total Tips</span>
                      <span className="summary-value text-center tips-value">{agent.total_tips.toFixed(2)}</span>
                    </div>
                    <div className="summary-item tips-summary">
                      <span className="summary-label text-center">Agent Tips</span>
                      <span className="summary-value text-center highlight agent-tips-value">{agent.total_agent_tips.toFixed(2)}</span>
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
      ) : (
        <div className="empty-message">
          No detailed agent report data available. Adjust filters or upload game data
        </div>
      )}
    </div>
  );
}

export default DetailedAgentReport;
