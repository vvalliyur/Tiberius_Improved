import { useState, useEffect } from 'react';
import { getAgents, upsertAgent } from '../utils/api';
import DataTable from '../components/DataTable';
import './Agents.css';

function Agents() {
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [formData, setFormData] = useState({
    agent_id: null,
    agent_name: '',
    deal_percent: '',
    comm_channel: '',
    notes: '',
    payment_methods: '',
  });

  const columns = [
    { accessorKey: 'agent_id', header: 'Agent ID' },
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'deal_percent', header: 'Deal %', cell: info => `${(Number(info.getValue()) * 100).toFixed(2)}%` },
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
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getAgents();
      setAgents(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch agents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (agent) => {
    setFormData({
      agent_id: agent.agent_id,
      agent_name: agent.agent_name || '',
      deal_percent: agent.deal_percent || '',
      comm_channel: agent.comm_channel || '',
      notes: agent.notes || '',
      payment_methods: agent.payment_methods || '',
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
        agent_id: isUpdateMode ? formData.agent_id : null,
        agent_name: formData.agent_name,
        deal_percent: parseFloat(formData.deal_percent),
        comm_channel: formData.comm_channel || null,
        notes: formData.notes || null,
        payment_methods: formData.payment_methods || null,
      };

      await upsertAgent(submitData);
      await fetchAgents();
      handleCloseForm();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save agent');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setIsUpdateMode(false);
    setFormData({
      agent_id: null,
      agent_name: '',
      deal_percent: '',
      comm_channel: '',
      notes: '',
      payment_methods: '',
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
      <div className="page-header">
        <button onClick={() => setIsFormOpen(true)} className="create-button">
          Create Agent
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {isFormOpen && (
        <div className="form-overlay">
          <div className="form-container">
            <h2>{isUpdateMode ? 'Update Agent' : 'Create Agent'}</h2>
            <form onSubmit={handleSubmit}>
              {isUpdateMode && (
                <div className="form-group">
                  <label>Agent ID</label>
                  <input
                    type="text"
                    value={formData.agent_id || ''}
                    disabled
                    className="disabled-input"
                  />
                </div>
              )}
              <div className="form-group">
                <label>Agent Name *</label>
                <input
                  type="text"
                  name="agent_name"
                  value={formData.agent_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Deal % *</label>
                <input
                  type="number"
                  name="deal_percent"
                  value={formData.deal_percent}
                  onChange={handleChange}
                  step="0.001"
                  required
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
        data={agents}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No agents found. Create your first agent"
      />
    </div>
  );
}

export default Agents;

