import { useState } from 'react';
import { getDetailedAgentReport } from '../utils/api';
import DateRangeFilter from '../components/DateRangeFilter';
import './DetailedAgentReport.css';

function DetailedAgentReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lookbackDays, setLookbackDays] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFetch = async () => {
    if (!lookbackDays && (!startDate || !endDate)) {
      setError('Please provide either date range or lookback days');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await getDetailedAgentReport(startDate || null, endDate || null, lookbackDays);
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
          {agents.map((agent) => (
            <div key={agent.agent_id} className="agent-section">
              <div className="agent-header">
                <div className="agent-info">
                  <h2>{agent.agent_name}</h2>
                  <span className="agent-id">ID: {agent.agent_id}</span>
                  <span className="deal-percent">Deal: {agent.deal_percent}%</span>
                </div>
                <div className="agent-summary">
                  <div className="summary-item">
                    <span className="summary-label">Total Players</span>
                    <span className="summary-value">{agent.players.length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Hands</span>
                    <span className="summary-value">{agent.total_hands.toLocaleString()}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Tips</span>
                    <span className="summary-value">${agent.total_tips.toFixed(2)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Agent Tips</span>
                    <span className="summary-value highlight">${agent.total_agent_tips.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="players-table-container">
                <table className="players-table">
                  <thead>
                    <tr>
                      <th>Player ID</th>
                      <th>Player Name</th>
                      <th>Total Hands</th>
                      <th>Total Tips</th>
                      <th>Agent Tips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agent.players.map((player) => (
                      <tr key={player.player_id}>
                        <td>{player.player_id}</td>
                        <td>{player.player_name}</td>
                        <td>{player.total_hands.toLocaleString()}</td>
                        <td>${player.total_tips.toFixed(2)}</td>
                        <td className="agent-tips-cell">${player.agent_tips.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
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

