import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import Agents from './Agents';
import Players from './Players';

function Management() {
  const [activeTab, setActiveTab] = useState('agents');

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-2 h-[88px] flex flex-col justify-center">
        <h1 className="text-4xl font-bold tracking-tight">Management</h1>
        <p className="text-lg text-muted-foreground">Manage agents and players</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="agents" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
        </TabsList>
        {activeTab === 'agents' && (
          <TabsContent value="agents" className="mt-6">
            <Agents />
          </TabsContent>
        )}
        {activeTab === 'players' && (
          <TabsContent value="players" className="mt-6">
            <Players />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default Management;

