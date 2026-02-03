import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import Agents from './Agents';
import Players from './Players';

function Management() {
  const [activeTab, setActiveTab] = useState('agents');

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Management</h1>
          <p className="text-lg text-muted-foreground">Manage agents and players</p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="agents" className="w-auto">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="w-full">
        {activeTab === 'agents' && <Agents />}
        {activeTab === 'players' && <Players />}
      </div>
    </div>
  );
}

export default Management;

