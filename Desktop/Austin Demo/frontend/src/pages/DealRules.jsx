import { useState, useEffect } from 'react';
import { getAgents, getDealRules, upsertDealRule } from '../utils/api';
import DataTable from '../components/DataTable';
import Drawer from '../components/Drawer';
import { formatCurrency } from '../utils/numberFormat';
import './Agents.css';

function DealRules() {
  const [dealRules, setDealRules] = useState([]);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    agent_id: '',
    threshold: '',
    deal_percent: '',
  });

  const formatDealPercent = (value) => {
    const percent = Number(value) * 100;
    // Round to 2 decimal places, then remove trailing zeros
    const rounded = Math.round(percent * 100) / 100;
    // Format to remove unnecessary decimals
    return rounded % 1 === 0 ? `${rounded}%` : rounded.toFixed(2).replace(/\.?0+$/, '') + '%';
  };

  const columns = [
    { accessorKey: 'agent_name', header: 'Agent Name' },
    { accessorKey: 'threshold', header: 'Threshold', cell: info => formatCurrency(info.getValue()) },
    { accessorKey: 'deal_percent', header: 'Deal %', cell: info => formatDealPercent(info.getValue()) },
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
    fetchDealRules();
    fetchAgents();
  }, []);

  const fetchDealRules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getDealRules();
      setDealRules(response.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch deal rules');
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

  const handleEdit = (dealRule) => {
    setFormData({
      id: dealRule.id,
      agent_id: dealRule.agent_id || '',
      threshold: dealRule.threshold || '',
      deal_percent: dealRule.deal_percent ? (dealRule.deal_percent * 100).toFixed(3) : '',
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
        agent_id: parseInt(formData.agent_id),
        threshold: parseFloat(formData.threshold),
        deal_percent: parseFloat(formData.deal_percent) / 100, // Convert percentage to decimal
      };

      await upsertDealRule(submitData);
      await fetchDealRules();
      handleCloseForm();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save deal rule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setIsUpdateMode(false);
    setFormData({
      id: null,
      agent_id: '',
      threshold: '',
      deal_percent: '',
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

      <Drawer
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title={isUpdateMode ? 'Update Deal Rule' : 'Create Deal Rule'}
      >
        <form onSubmit={handleSubmit}>
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
                <label>Threshold ($) *</label>
                <input
                  type="number"
                  name="threshold"
                  value={formData.threshold}
                  onChange={handleChange}
                  step="0.01"
                  required
                  placeholder="e.g., 1000.00"
                />
                <small className="form-help-text">Rule applies when tips >= this threshold</small>
              </div>
              <div className="form-group">
                <label>Deal % *</label>
                <input
                  type="number"
                  name="deal_percent"
                  value={formData.deal_percent}
                  onChange={handleChange}
                  step="0.001"
                  min="0"
                  max="100"
                  required
                  placeholder="e.g., 15.5 for 15.5%"
                />
                <small className="form-help-text">Enter as percentage (e.g., 15.5 for 15.5%)</small>
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
      </Drawer>

      <DataTable
        data={dealRules}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No deal rules found. Create your first deal rule"
        searchBarActions={
          <button onClick={() => setIsFormOpen(true)} className="create-button">
            Create Deal Rule
          </button>
        }
      />
    </div>
  );
}

export default DealRules;

