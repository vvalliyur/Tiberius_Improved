import { useState, useEffect } from 'react';
import { getAgents, getPlayers, upsertPlayer } from '../utils/api';
import DataTable from '../components/DataTable';
import './Players.css';

function Players() {
  const [players, setPlayers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [formData, setFormData] = useState({
    player_id: null,
    player_name: '',
    agent_id: '',
    credit_limit: '',
    weekly_credit_adjustment: '',
    comm_channel: '',
    notes: '',
    payment_methods: '',
    do_not_allow: false,
  });

  const columns = [
    { accessorKey: 'player_id', header: 'Player ID' },
    { accessorKey: 'player_name', header: 'Player Name' },
    { accessorKey: 'agent_id', header: 'Agent ID' },
    { accessorKey: 'credit_limit', header: 'Credit Limit' },
    { accessorKey: 'weekly_credit_adjustment', header: 'Weekly Credit Adjustment', cell: info => {
      const value = info.getValue();
      return value !== null && value !== undefined ? Number(value).toFixed(2) : '0.00';
    }},
    { accessorKey: 'is_blocked', header: 'Do Not Allow', cell: info => info.getValue() ? 'Yes' : 'No' },
    { accessorKey: 'comm_channel', header: 'Comm Channel' },
    { accessorKey: 'notes', header: 'Notes' },
    { accessorKey: 'payment_methods', header: 'Payment Methods' },
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
    fetchPlayers();
    fetchAgents();
  }, []);

  const fetchPlayers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getPlayers();
      setPlayers(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch players');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await getAgents();
      setAgents(response.data || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const handleEdit = (player) => {
    setFormData({
      player_id: player.player_id,
      player_name: player.player_name || '',
      agent_id: player.agent_id || '',
      credit_limit: player.credit_limit || '',
      weekly_credit_adjustment: player.weekly_credit_adjustment !== undefined && player.weekly_credit_adjustment !== null ? player.weekly_credit_adjustment : '',
      comm_channel: player.comm_channel || '',
      notes: player.notes || '',
      payment_methods: player.payment_methods || '',
      do_not_allow: player.is_blocked || false,
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
        player_id: isUpdateMode ? formData.player_id : null,
        player_name: formData.player_name,
        agent_id: formData.agent_id ? parseInt(formData.agent_id) : null,
        credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
        weekly_credit_adjustment: formData.weekly_credit_adjustment ? parseFloat(formData.weekly_credit_adjustment) : 0.0,
        comm_channel: formData.comm_channel || null,
        notes: formData.notes || null,
        payment_methods: formData.payment_methods || null,
        is_blocked: formData.do_not_allow,
      };

      await upsertPlayer(submitData);
      await fetchPlayers();
      handleCloseForm();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save player');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setIsUpdateMode(false);
    setFormData({
      player_id: null,
      player_name: '',
      agent_id: '',
      credit_limit: '',
      weekly_credit_adjustment: '',
      comm_channel: '',
      notes: '',
      payment_methods: '',
      do_not_allow: false,
    });
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  return (
    <div className="players-page">
      <div className="page-header">
        <button onClick={() => setIsFormOpen(true)} className="create-button">
          Create Player
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {isFormOpen && (
        <div className="form-overlay">
          <div className="form-container">
            <h2>{isUpdateMode ? 'Update Player' : 'Create Player'}</h2>
            <form onSubmit={handleSubmit}>
              {isUpdateMode && (
                <div className="form-group">
                  <label>Player ID</label>
                  <input
                    type="text"
                    value={formData.player_id || ''}
                    disabled
                    className="disabled-input"
                  />
                </div>
              )}
              <div className="form-group">
                <label>Player Name *</label>
                <input
                  type="text"
                  name="player_name"
                  value={formData.player_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Agent ID</label>
                <select
                  name="agent_id"
                  value={formData.agent_id}
                  onChange={handleChange}
                >
                  <option value="">None</option>
                  {agents.map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.agent_name} (ID: {agent.agent_id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Credit Limit</label>
                <input
                  type="number"
                  name="credit_limit"
                  value={formData.credit_limit}
                  onChange={handleChange}
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Weekly Credit Adjustment</label>
                <input
                  type="number"
                  name="weekly_credit_adjustment"
                  value={formData.weekly_credit_adjustment}
                  onChange={handleChange}
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Comm Channel</label>
                <input
                  type="text"
                  name="comm_channel"
                  value={formData.comm_channel}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Payment Methods</label>
                <input
                  type="text"
                  name="payment_methods"
                  value={formData.payment_methods}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="do_not_allow"
                    checked={formData.do_not_allow}
                    onChange={handleChange}
                  />
                  {' '}Do Not Allow
                </label>
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
        data={players}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No players found. Create your first player"
      />
    </div>
  );
}

export default Players;

