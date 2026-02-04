import { useState, useEffect } from 'react';
import { getAgents, getRealNames, upsertRealName } from '../utils/api';
import DataTable from '../components/DataTable';
import './Agents.css';

function RealNames() {
  const [realNames, setRealNames] = useState([]);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    player_id: '',
    agent_id: '',
    real_name: '',
  });

  const columns = [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'agent_id', header: 'Agent ID' },
    { accessorKey: 'real_name', header: 'Real Name' },
    {
      accessorKey: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <button
          onClick={() => handleEdit(row.original)}
          className="edit-button"
        >
          Edit
        </button>
      ),
    },
  ];

  useEffect(() => {
    fetchRealNames();
    fetchAgents();
  }, []);

  const fetchRealNames = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getRealNames();
      setRealNames(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch real names');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await getAgents();
      setAgents(response.data || []);
    } catch (err) {
      // Error handled silently
    }
  };

  const handleEdit = (realName) => {
    setFormData({
      id: realName.id,
      player_id: realName.player_id || '',
      agent_id: realName.agent_id || '',
      real_name: realName.real_name || '',
    });
    setIsUpdateMode(true);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const submitData = {
        id: isUpdateMode ? formData.id : null,
        player_id: formData.player_id,
        agent_id: parseInt(formData.agent_id),
        real_name: formData.real_name,
      };

      await upsertRealName(submitData);
      await fetchRealNames();
      handleCloseForm();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save real name mapping');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setIsUpdateMode(false);
    setFormData({
      id: null,
      player_id: '',
      agent_id: '',
      real_name: '',
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="agents-page">
      {error && <div className="error-message">{error}</div>}

      {isFormOpen && (
        <div className="form-overlay">
          <div className="form-container">
            <h2>{isUpdateMode ? 'Update Real Name Mapping' : 'Create Real Name Mapping'}</h2>
            <form onSubmit={handleSubmit}>
              {isUpdateMode && (
                <div className="form-group">
                  <label>ID</label>
                  <input
                    type="text"
                    value={formData.id || ''}
                    disabled
                    className="disabled-input"
                  />
                </div>
              )}
              <div className="form-group">
                <label>Player ID *</label>
                <input
                  type="text"
                  name="player_id"
                  value={formData.player_id}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Agent *</label>
                <select
                  name="agent_id"
                  value={formData.agent_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Agent</option>
                  {agents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.agent_name} (ID: {agent.agent_id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Real Name *</label>
                <input
                  type="text"
                  name="real_name"
                  value={formData.real_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" disabled={isLoading} className="submit-button">
                  {isLoading ? 'Saving...' : isUpdateMode ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={handleCloseForm} className="cancel-button">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DataTable
        data={realNames}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No real name mappings found. Create your first mapping"
        searchBarActions={
          <button onClick={() => setIsFormOpen(true)} className="create-button">
            Create Real Name
          </button>
        }
      />
    </div>
  );
}

export default RealNames;

