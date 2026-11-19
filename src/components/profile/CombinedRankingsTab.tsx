
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RankingsTab from './RankingsTab';
import CreatedRankingsTab from './CreatedRankingsTab';

interface CombinedRankingsTabProps {
  userId: string;
  userRankings?: any[];
  isAuthenticated?: boolean;
}

const CombinedRankingsTab: React.FC<CombinedRankingsTabProps> = ({
  userId,
  userRankings,
  isAuthenticated
}) => {
  return (
    <div>
      <Tabs defaultValue="participating" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="participating">Participando</TabsTrigger>
          <TabsTrigger value="created">Criados</TabsTrigger>
        </TabsList>
        
        <TabsContent value="participating">
          <RankingsTab 
            userId={userId}
            userRankings={userRankings}
            isAuthenticated={isAuthenticated}
          />
        </TabsContent>
        
        <TabsContent value="created">
          <CreatedRankingsTab userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CombinedRankingsTab;
