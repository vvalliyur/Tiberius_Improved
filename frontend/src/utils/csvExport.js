/**
 * Convert an array of objects to CSV format
 * @param {Array} data - Array of objects to convert
 * @param {Array} columns - Array of column definitions with accessorKey and header
 * @returns {string} CSV string
 */
export const convertToCSV = (data, columns) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Get headers from columns
  const headers = columns.map(col => col.header || col.accessorKey);
  
  // Get accessor keys
  const keys = columns.map(col => col.accessorKey);
  
  // Create CSV rows
  const rows = data.map(row => {
    return keys.map(key => {
      const value = row[key];
      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }
      // Convert to string and escape quotes
      const stringValue = String(value);
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
  });
  
  // Combine headers and rows
  const csvRows = [headers, ...rows];
  
  // Join rows with newlines
  return csvRows.map(row => row.join(',')).join('\n');
};

/**
 * Download data as CSV file
 * @param {string} csvContent - CSV string content
 * @param {string} filename - Filename for the download
 */
export const downloadCSV = (csvContent, filename) => {
  // Create blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Download data errors as CSV
 * @param {Object} dataErrors - Object containing error data
 * @param {string} errorType - Type of error to download
 * @param {Array} columns - Column definitions for the error type
 */
export const downloadDataErrors = (dataErrors, errorType, columns) => {
  const errorData = dataErrors[errorType];
  
  if (!errorData || !errorData.data || errorData.data.length === 0) {
    alert('No data to download');
    return;
  }
  
  const csvContent = convertToCSV(errorData.data, columns);
  const filename = `${errorType}_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, filename);
};

/**
 * Download all data errors as a combined CSV
 * @param {Object} dataErrors - Object containing all error data
 * @param {Object} columnMap - Map of error types to their column definitions
 */
export const downloadAllDataErrors = (dataErrors, columnMap) => {
  const allRows = [];
  const allColumns = [
    { accessorKey: 'error_type', header: 'Error Type' },
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_id', header: 'Agent ID' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'game_count', header: 'Game Count' },
    { accessorKey: 'total_tips', header: 'Total Tips' },
    { accessorKey: 'default_deal_percent', header: 'Default Deal %' },
    { accessorKey: 'rule_count', header: 'Rule Count' },
    { accessorKey: 'error_description', header: 'Error Description' },
  ];
  
  // Add players in games not in players
  if (dataErrors.players_in_games_not_in_players?.data?.length > 0) {
    dataErrors.players_in_games_not_in_players.data.forEach(row => {
      allRows.push({
        error_type: 'Players in Games Not in Players Table',
        player_id: row.player_id,
        player_name: row.player_name,
        agent_id: '',
        agent_name: '',
        game_count: row.game_count,
        total_tips: row.total_tips,
        default_deal_percent: '',
        rule_count: '',
        error_description: 'Player exists in games table but not in players table',
      });
    });
  }
  
  // Add players not mapped to agents
  if (dataErrors.players_not_mapped_to_agents?.data?.length > 0) {
    dataErrors.players_not_mapped_to_agents.data.forEach(row => {
      allRows.push({
        error_type: 'Players Not Mapped to Agents',
        player_id: row.player_id,
        player_name: row.player_name,
        agent_id: row.agent_id || '',
        agent_name: '',
        game_count: '',
        total_tips: '',
        default_deal_percent: '',
        rule_count: '',
        error_description: row.error_description,
      });
    });
  }
  
  // Add agents not mapped to deal rules
  if (dataErrors.agents_not_mapped_to_deal_rules?.data?.length > 0) {
    dataErrors.agents_not_mapped_to_deal_rules.data.forEach(row => {
      allRows.push({
        error_type: 'Agents Not Mapped to Deal Rules',
        player_id: '',
        player_name: '',
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        game_count: '',
        total_tips: '',
        default_deal_percent: row.default_deal_percent,
        rule_count: row.rule_count,
        error_description: 'Agent has no deal_percent_rules configured',
      });
    });
  }
  
  if (allRows.length === 0) {
    alert('No data to download');
    return;
  }
  
  const csvContent = convertToCSV(allRows, allColumns);
  const filename = `data_quality_errors_all_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, filename);
};

