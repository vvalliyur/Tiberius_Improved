import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import Agents from './Agents';
import Players from './Players';
import RealNames from './RealNames';
import DealRules from './DealRules';

function Management() {
  const [activeTab, setActiveTab] = useState('agents');

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Management</h1>
          <p className="text-lg text-muted-foreground">Manage agents, players, real names, and deal rules</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="agents" className="w-auto">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="real-names">Real Names</TabsTrigger>
            <TabsTrigger value="deal-rules">Deal Rules</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="w-full">
        {activeTab === 'agents' && <Agents />}
        {activeTab === 'players' && <Players />}
        {activeTab === 'real-names' && <RealNames />}
        {activeTab === 'deal-rules' && <DealRules />}
      </div>
    </div>
  );
}

export default Management;

