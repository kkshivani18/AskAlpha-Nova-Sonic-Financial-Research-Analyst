import React from 'react';

interface FormattedResultProps {
  data: any;
  toolName: string;
}

export const FormattedResult: React.FC<FormattedResultProps> = ({ data, toolName }) => {
  if (toolName === 'EXECUTE_QUANTITATIVE_MODEL') {
    // Monte Carlo simulation results
    const monte = data?.monte_carlo || data;
    return (
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-gray-700 pb-2">
          <span className="text-gray-400 font-bold uppercase tracking-wider">Monte Carlo Simulation</span>
        </div>
        <div className="space-y-2">
          {monte.ticker && (
            <div className="flex justify-between items-start">
              <span className="text-gray-500">Ticker:</span>
              <span className="text-blue-300 font-mono font-bold">{monte.ticker}</span>
            </div>
          )}
          {monte.current_price && (
            <div className="flex justify-between items-start">
              <span className="text-gray-500">Price:</span>
              <span className="text-green-400 font-mono">${monte.current_price.toFixed(2)}</span>
            </div>
          )}
          {monte.volatility && (
            <div className="flex justify-between items-start">
              <span className="text-gray-500">Volatility:</span>
              <span className="text-yellow-300 font-mono">{(monte.volatility * 100).toFixed(2)}%</span>
            </div>
          )}
          {monte.percentiles && (
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="text-gray-400 font-bold mb-1">Percentiles (End Price):</div>
              <div className="grid grid-cols-3 gap-2 pl-2">
                {monte.percentiles.p10 && (
                  <div><span className="text-gray-500">p10:</span> <span className="text-orange-300">${monte.percentiles.p10.toFixed(2)}</span></div>
                )}
                {monte.percentiles.p50 && (
                  <div><span className="text-gray-500">p50:</span> <span className="text-blue-300">${monte.percentiles.p50.toFixed(2)}</span></div>
                )}
                {monte.percentiles.p90 && (
                  <div><span className="text-gray-500">p90:</span> <span className="text-green-300">${monte.percentiles.p90.toFixed(2)}</span></div>
                )}
              </div>
            </div>
          )}
          {monte.num_simulations && (
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex justify-between items-start">
                <span className="text-gray-500">Simulations:</span>
                <span className="text-purple-300 font-mono">{monte.num_simulations.toLocaleString()}</span>
              </div>
            </div>
          )}
          {monte.days && (
            <div className="flex justify-between items-start">
              <span className="text-gray-500">Period:</span>
              <span className="text-purple-300 font-mono">{monte.days} days</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (toolName === 'QUERY_LIVE_MARKET_DATA') {
    // Market snapshot data
    return (
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-gray-700 pb-2">
          <span className="text-gray-400 font-bold uppercase tracking-wider">Market Snapshot</span>
        </div>
        <div className="space-y-2">
          {data?.ticker && (
            <div className="flex justify-between items-start">
              <span className="text-gray-400">COMPANY (Ticker)</span>
              <span className="text-blue-400 font-mono font-bold">{data.ticker}</span>
            </div>
          )}
          {data?.price !== undefined && (
            <div className="flex justify-between items-start">
              <span className="text-gray-400">PRICE</span>
              <span className="text-green-400 font-mono">${data.price.toFixed(2)}</span>
            </div>
          )}
          {data?.volume !== undefined && (
            <div className="flex justify-between items-start">
              <span className="text-gray-400">VOLUME</span>
              <span className="text-yellow-400 font-mono">{(data.volume / 1000000).toFixed(2)} M</span>
            </div>
          )}
          {data?.change_percent !== undefined && (
            <div className="flex justify-between items-start">
              <span className="text-gray-400">CHANGE:</span>
              <span className={data.change_percent >= 0 ? "text-green-400 font-mono" : "text-red-400 font-mono"}>
                {data.change_percent >= 0 ? '+' : ''}{data.change_percent.toFixed(2)}%
              </span>
            </div>
          )}
          {data?.high_52w && (
            <div className="flex justify-between items-start">
              <span className="text-gray-400">52W HIGH:</span>
              <span className="text-blue-400 font-mono">${data.high_52w.toFixed(2)}</span>
            </div>
          )}
          {data?.low_52w && (
            <div className="flex justify-between items-start">
              <span className="text-gray-400">52W LOW:</span>
              <span className="text-blue-400 font-mono">${data.low_52w.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (toolName === 'ANALYZE_SEC_FILINGS_RAG') {
    // SEC filing analysis
    return (
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-gray-700 pb-2">
          <span className="text-gray-500 font-bold uppercase tracking-wider">SEC Filing Analysis</span>
        </div>
        <div className="space-y-2">
          {data?.filing_type && (
            <div className="flex justify-between items-start">
              <span className="text-gray-400">TYPE:</span>
              <span className="text-blue-400 font-mono">{data.filing_type}</span>
            </div>
          )}
          {data?.company && (
            <div className="flex justify-between items-start">
              <span className="text-gray-400">COMPANY:</span>
              <span className="text-blue-400 font-mono">{data.company}</span>
            </div>
          )}
          {data?.summary && (
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="text-gray-400 font-bold mb-1">SUMMARY:</div>
              <p className="text-gray-400 pl-2 leading-relaxed">{data.summary}</p>
            </div>
          )}
          {data?.key_metrics && (
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="text-gray-400 font-bold mb-1">KEY METRICS:</div>
              <div className="pl-2 space-y-1">
                {Object.entries(data.key_metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-500">{key}:</span>
                    <span className="text-blue-400">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback for unknown tool types - show formatted JSON
  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-gray-700 pb-2">
        <span className="text-gray-400 font-bold uppercase tracking-wider">{toolName}</span>
      </div>
      <pre className="text-green-400/90 leading-relaxed overflow-x-auto whitespace-pre-wrap text-[9px]">
        {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};
