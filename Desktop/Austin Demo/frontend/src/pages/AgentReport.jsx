import { useState } from 'react';
import { getAgentReport } from '../utils/api';
import DataTable from '../components/DataTable';
import DateRangeFilter from '../components/DateRangeFilter';
import './AgentReport.css';

function AgentReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lookbackDays, setLookbackDays] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const columns = [
    { accessorKey: 'agent_id', header: 'Agent ID' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    {
      accessorKey: 'total_profit',
      header: 'Total Profit',
      cell: info => {
        const value = Number(info.getValue());
        return (
          <span className={value >= 0 ? 'profit-positive' : 'profit-negative'}>
            {value.toFixed(2)}
          </span>
        );
      },
    },
    {
      accessorKey: 'total_tips',
      header: 'Total Tips',
      cell: info => Number(info.getValue()).toFixed(2),
    },
    {
      accessorKey: 'agent_tips',
      header: 'Agent Tips',
      cell: info => Number(info.getValue()).toFixed(2),
    },
    { accessorKey: 'game_count', header: 'Game Count' },
  ];

  const handleFetch = async () => {
    if (!lookbackDays && (!startDate || !endDate)) {
      setError('Please provide either date range or lookback days');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await getAgentReport(startDate || null, endDate || null, lookbackDays);
      setReportData(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch agent report');
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="agent-report-page">
      <div className="page-header">
        <h1>Agent Report</h1>
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

      <div className="report-summary">
        <div className="summary-card">
          <div className="summary-label">Total Agents</div>
          <div className="summary-value">{reportData.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Games</div>
          <div className="summary-value">
            {reportData.reduce((sum, row) => sum + (row.game_count || 0), 0)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Agent Tips</div>
          <div className="summary-value">
            {reportData.reduce((sum, row) => sum + Number(row.agent_tips || 0), 0).toFixed(2)}
          </div>
        </div>
      </div>

      <DataTable
        data={reportData}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No agent report data available. Adjust filters or upload game data"
      />
    </div>
  );
}

export default AgentReport;

