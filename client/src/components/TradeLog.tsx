import { ScrollArea } from "@/components/ui/scroll-area";
import { Trade } from "@shared/schema";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, Clock, ShieldAlert, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface TradeLogProps {
  trades: Trade[];
  isLoading: boolean;
}

export function TradeLog({ trades, isLoading }: TradeLogProps) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground animate-pulse">
        Loading trade history...
      </div>
    );
  }

  const getExitIcon = (reason: string | null) => {
    switch (reason) {
      case "TP": return <Target className="w-3 h-3 text-emerald-500" />;
      case "STOP_LOSS": return <ShieldAlert className="w-3 h-3 text-rose-500" />;
      case "TIME_EXIT": return <Clock className="w-3 h-3 text-amber-500" />;
      case "EMERGENCY": return <ShieldAlert className="w-3 h-3 text-rose-500" />;
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col glass-panel rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-secondary/20 backdrop-blur-sm sticky top-0 z-10">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Recent Activity</h3>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="divide-y divide-white/5">
          {trades.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No trades recorded yet.
            </div>
          ) : (
            trades.map((trade) => {
              const isProfit = Number(trade.profit) >= 0;
              const isOpen = trade.status === "OPEN";

              return (
                <div key={trade.id} className="p-3 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-bold px-1.5 py-0.5 rounded border font-mono-numbers",
                        isOpen 
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                          : isProfit 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      )}>
                        {trade.symbol}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono-numbers">
                        {format(new Date(trade.entryTime), "HH:mm:ss")}
                      </span>
                    </div>
                    
                    {isOpen ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 animate-pulse">
                        Active
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80 bg-secondary/40 px-2 py-0.5 rounded-full">
                        {getExitIcon(trade.exitReason)}
                        <span className="text-[10px] uppercase">{trade.exitReason?.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground text-xs">
                        <span className="block text-[10px] opacity-60 uppercase">Entry</span>
                        <span className="font-mono-numbers text-foreground">{trade.entryPrice}</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        <span className="block text-[10px] opacity-60 uppercase">Exit</span>
                        <span className="font-mono-numbers text-foreground">{trade.exitPrice || "---"}</span>
                      </div>
                    </div>

                    {!isOpen && (
                      <div className={cn(
                        "flex flex-col items-end font-mono-numbers font-medium",
                        isProfit ? "text-emerald-500" : "text-rose-500"
                      )}>
                        <div className="flex items-center gap-1">
                          {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {trade.profitPercent}%
                        </div>
                        <span className="text-[10px] opacity-80">${trade.profit}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
