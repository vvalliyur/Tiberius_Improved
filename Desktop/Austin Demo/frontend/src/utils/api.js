import axios from 'axios';

// Update this with your backend URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('supabase_token');
  console.log('API Request Interceptor');
  console.log('  URL:', config.url);
  console.log('  Method:', config.method);
  console.log('  Token in localStorage:', token ? `${token.substring(0, 30)}...` : 'MISSING');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('  Authorization header set:', `Bearer ${token.substring(0, 20)}...`);
  } else {
    console.error('  ❌ No auth token found in localStorage. Request will fail with 401.');
  }
  
  console.log('  Request headers:', {
    ...config.headers,
    Authorization: config.headers.Authorization ? `${config.headers.Authorization.substring(0, 30)}...` : 'NOT SET'
  });
  
  return config;
});

// Handle auth errors and network errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors (backend not running)
    if (!error.response && error.message) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.code === 'ERR_NETWORK') {
        console.error('Network error - Backend may not be running:', error.message);
        error.userMessage = 'Cannot connect to server. Please make sure the backend is running on http://localhost:8000';
      }
    }
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      console.error('401 Unauthorized:', error.response?.data);
      console.error('Token in localStorage:', localStorage.getItem('supabase_token') ? 'Exists' : 'Missing');
      localStorage.removeItem('supabase_token');
      error.userMessage = 'Session expired. Please log in again.';
      // Don't reload immediately - let user see the error
      // window.location.reload();
    }
    
    return Promise.reject(error);
  }
);

// API functions
export const getData = async (startDate, endDate, lookbackDays = null, clubCode = null) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (lookbackDays) params.lookback_days = lookbackDays;
  if (clubCode) params.club_code = clubCode;
  const response = await api.get('/get_data', { params });
  return response.data;
};

export const getAggregatedData = async (startDate, endDate, lookbackDays = null) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (lookbackDays) params.lookback_days = lookbackDays;
  const response = await api.get('/get_aggregated_data', { params });
  return response.data;
};

export const getAgents = async () => {
  const response = await api.get('/get_agents');
  return response.data;
};

export const getPlayers = async () => {
  const response = await api.get('/get_players');
  return response.data;
};

export const getAgentReport = async (startDate, endDate, lookbackDays = null) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (lookbackDays) params.lookback_days = lookbackDays;
  const response = await api.get('/get_agent_report', { params });
  return response.data;
};

export const getDetailedAgentReport = async (startDate, endDate, lookbackDays = null) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (lookbackDays) params.lookback_days = lookbackDays;
  const response = await api.get('/get_detailed_agent_report', { params });
  return response.data;
};

export const getAgentReports = async (startDate, endDate, lookbackDays = null) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (lookbackDays) params.lookback_days = lookbackDays;
  const response = await api.get('/get_agent_reports', { params });
  return response.data;
};

export const getCreateUpdateHistory = async (startDate, endDate, lookbackDays = null, tableName = null, operationType = null) => {
  const params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (lookbackDays) params.lookback_days = lookbackDays;
  if (tableName) params.table_name = tableName;
  if (operationType) params.operation_type = operationType;
  const response = await api.get('/get_create_update_history', { params });
  return response.data;
};

export const getPlayerHistory = async (startDate, endDate, playerIds, lookbackDays = null) => {
  const params = {
    player_ids: Array.isArray(playerIds) ? playerIds.join(',') : playerIds,
  };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (lookbackDays) params.lookback_days = lookbackDays;
  const response = await api.get('/get_player_history', { params });
  return response.data;
};

export const upsertAgent = async (agentData) => {
  const response = await api.post('/agents/upsert', agentData);
  return response.data;
};

export const upsertPlayer = async (playerData) => {
  const response = await api.post('/players/upsert', playerData);
  return response.data;
};

export const getDashboardData = async () => {
  const response = await api.get('/get_dashboard_data');
  return response.data;
};

export default api;

