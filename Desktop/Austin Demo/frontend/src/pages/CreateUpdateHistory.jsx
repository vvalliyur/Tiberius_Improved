import { useState, useEffect, useMemo } from 'react';
import { getCreateUpdateHistory } from '../utils/api';
import DateRangeFilter from '../components/DateRangeFilter';
import DataTable from '../components/DataTable';
import './CreateUpdateHistory.css';

function CreateUpdateHistory() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lookbackDays, setLookbackDays] = useState(null);
  const [tableName, setTableName] = useState('');
  const [operationType, setOperationType] = useState('');
  const [historyData, setHistoryData] = useState([]);
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
      const response = await getCreateUpdateHistory(
        startDate || null,
        endDate || null,
        lookbackDays,
        tableName || null,
        operationType || null
      );
      setHistoryData(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch history');
      setHistoryData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const historyColumns = useMemo(() => [
    {
      accessorKey: 'created_at',
      header: 'Timestamp',
      cell: info => {
        const date = new Date(info.getValue());
        return date.toLocaleString();
      }
    },
    {
      accessorKey: 'user_email',
      header: 'User',
      cell: info => info.getValue() || 'N/A'
    },
    {
      accessorKey: 'operation_type',
      header: 'Operation',
      cell: info => {
        const op = info.getValue();
        return (
          <span className={`operation-badge operation-${op.toLowerCase()}`}>
            {op}
          </span>
        );
      }
    },
    {
      accessorKey: 'table_name',
      header: 'Table',
      cell: info => info.getValue()
    },
    {
      accessorKey: 'record_id',
      header: 'Record ID',
      cell: info => info.getValue() || 'N/A'
    },
    {
      accessorKey: 'operation_data',
      header: 'Details',
      cell: info => {
        const data = info.getValue();
        if (!data) return 'N/A';
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          return (
            <details className="operation-details">
              <summary>View Details</summary>
              <pre>{JSON.stringify(parsed, null, 2)}</pre>
            </details>
          );
        } catch {
          return <span className="details-text">{String(data)}</span>;
        }
      }
    },
  ], []);

  return (
    <div className="create-update-history-page">
      <div className="page-header">
        <h1>Create/Update History</h1>
        <p className="page-description">
          View audit logs of all create and update operations in the system
        </p>
      </div>

      <div className="filters-section">
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

        <div className="additional-filters">
          <div className="filter-group">
            <label htmlFor="table-name">Table Name</label>
            <select
              id="table-name"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            >
              <option value="">All Tables</option>
              <option value="agents">Agents</option>
              <option value="players">Players</option>
              <option value="games">Games</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="operation-type">Operation Type</label>
            <select
              id="operation-type"
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
            >
              <option value="">All Operations</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="data-section">
        <p className="data-count">
          {historyData.length} {historyData.length === 1 ? 'record' : 'records'}
        </p>
        <DataTable
          data={historyData}
          columns={historyColumns}
          isLoading={isLoading}
          emptyMessage="No history data available. Adjust filters or perform some operations"
        />
      </div>
    </div>
  );
}

export default CreateUpdateHistory;

