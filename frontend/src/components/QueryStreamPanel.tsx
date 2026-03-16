import React from 'react';
import { Activity } from 'lucide-react';
import { Panel } from './Panel';
import { FormattedResult } from './FormattedResult';

interface QueryStreamPanelProps {
  queryResult: any;
  toolName: string;
}

export const QueryStreamPanel: React.FC<QueryStreamPanelProps> = ({ queryResult, toolName }) => {
  return (
    <Panel title="Query Stream" icon={Activity} className="h-1/2">
      {queryResult ? (
        <FormattedResult data={queryResult} toolName={toolName} />
      ) : (
        <div className="h-full flex flex-col items-center justify-center opacity-10 text-center">
          <Activity size={40} className="mb-3 animate-pulse" />
          <p className="text-[10px] uppercase tracking-widest font-bold">No Data Flow</p>
        </div>
      )}
    </Panel>
  );
};
