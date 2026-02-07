import { useTrades, useDashboardStats, useMarketHistory } from "@/hooks/use-financial-data";
import { KPICard } from "@/components/KPICard";
import { MarketChart } from "@/components/MarketChart";
import { TradeLog } from "@/components/TradeLog";
import { ConfigurationPanel } from "@/components/ConfigurationPanel";
import { 
  TrendingUp, 
  Activity, 
  DollarSign, 
  Ban, 
  Zap,
  BarChart3
} from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: trades, isLoading: tradesLoading } = useTrades(100);
  const { data: marketData, isLoading: marketLoading } = useMarketHistory();

  // Calculate trends (simple comparison for demo, ideally backend provides this)
  const isProfitPositive = Number(stats?.totalProfit) >= 0;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-display font-bold text-gradient">Continuous Profit Engine</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            System Operational • High-Frequency Scalping
          </p>
        </div>
        <div className="flex items-center gap-3 bg-secondary/30 px-4 py-2 rounded-full border border-white/5">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono text-muted-foreground">Latency: <span className="text-white">12ms</span></span>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-xs font-mono text-muted-foreground">API Status: <span className="text-emerald-400">Connected</span></span>
        </div>
      </header>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Total Profit" 
          value={`$${Number(stats?.totalProfit || 0).toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
          trend={isProfitPositive ? "up" : "down"}
          subtext="Cumulative P&L"
          isLoading={statsLoading}
        />
        <KPICard 
          title="Win Rate" 
          value={`${Number(stats?.winRate || 0).toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          trend={Number(stats?.winRate) > 50 ? "up" : "neutral"}
          subtext={`${stats?.activeTrades || 0} active positions`}
          isLoading={statsLoading}
        />
        <KPICard 
          title="Today's Volume" 
          value={stats?.tradesToday || 0}
          icon={<Activity className="w-5 h-5" />}
          subtext="Completed scalps"
          isLoading={statsLoading}
        />
        <KPICard 
          title="Daily Risk" 
          value={`-${Number(stats?.dailyLoss || 0).toFixed(2)}%`}
          icon={<Ban className="w-5 h-5" />}
          trend="down" // Always red as it represents risk/loss
          subtext="Max allowed: 5.0%"
          isLoading={statsLoading}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Chart Section */}
        <div className="lg:col-span-2 h-full min-h-[400px]">
          <MarketChart data={marketData || []} isLoading={marketLoading} />
        </div>

        {/* Trade Log Section */}
        <div className="h-full min-h-[400px]">
          <TradeLog trades={trades || []} isLoading={tradesLoading} />
        </div>
      </div>

      {/* Configuration Section */}
      <section className="mt-6">
        <ConfigurationPanel />
      </section>
    </div>
  );
}
