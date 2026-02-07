import { Candle } from "@shared/schema";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface MarketChartProps {
  data: Candle[];
  isLoading: boolean;
}

export function MarketChart({ data, isLoading }: MarketChartProps) {
  if (isLoading && data.length === 0) {
    return (
      <div className="h-full w-full glass-panel rounded-xl flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Pre-process data for charts
  const chartData = data.map(c => ({
    ...c,
    timeStr: format(new Date(c.time), "HH:mm:ss"),
    value: Number(c.close)
  }));

  const latestPrice = chartData[chartData.length - 1]?.value || 0;
  const prevPrice = chartData[chartData.length - 2]?.value || 0;
  const isUp = latestPrice >= prevPrice;

  return (
    <div className="h-full w-full glass-panel rounded-xl flex flex-col p-1 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-secondary/10">
        <div>
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Market Overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">BTC/USD • 1m Candles</p>
        </div>
        <div className="text-right">
          <p className={`text-xl font-bold font-mono-numbers ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
            ${latestPrice.toFixed(2)}
          </p>
        </div>
      </div>
      
      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isUp ? "#10b981" : "#f43f5e"} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={isUp ? "#10b981" : "#f43f5e"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="timeStr" 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis 
              domain={['auto', 'auto']} 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `$${val}`}
              width={60}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                borderColor: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                borderRadius: '8px',
                color: '#fff'
              }}
              itemStyle={{ color: '#fff', fontFamily: 'JetBrains Mono' }}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={isUp ? "#10b981" : "#f43f5e"} 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
