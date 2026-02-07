import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
  subtext?: string;
  isLoading?: boolean;
}

export function KPICard({ title, value, icon, trend, subtext, isLoading }: KPICardProps) {
  return (
    <div className="glass-panel rounded-xl p-5 relative overflow-hidden group hover:border-white/10 transition-colors duration-300">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className={cn(
          "p-2 rounded-lg bg-secondary/50 text-secondary-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors",
          trend === "up" && "text-emerald-500 bg-emerald-500/10",
          trend === "down" && "text-rose-500 bg-rose-500/10"
        )}>
          {icon}
        </div>
      </div>
      
      <div className="relative z-10">
        {isLoading ? (
          <div className="h-8 w-24 bg-secondary/50 animate-pulse rounded my-1" />
        ) : (
          <h3 className={cn(
            "text-2xl font-bold font-mono-numbers tracking-tight",
            trend === "up" && "text-emerald-500",
            trend === "down" && "text-rose-500"
          )}>
            {value}
          </h3>
        )}
        
        {subtext && (
          <p className="text-xs text-muted-foreground mt-1 font-medium">{subtext}</p>
        )}
      </div>

      {/* Decorative gradient blob */}
      <div className={cn(
        "absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 pointer-events-none transition-colors duration-500",
        trend === "up" ? "bg-emerald-500" : trend === "down" ? "bg-rose-500" : "bg-blue-500"
      )} />
    </div>
  );
}
