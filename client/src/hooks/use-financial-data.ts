import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

// Poll intervals
const FAST_POLL = 1000; // 1s for real-time stats
const CHART_POLL = 2000; // 2s for candles

// === TRADES ===

export function useTrades(limit = 50) {
  return useQuery({
    queryKey: [api.trades.list.path, limit],
    queryFn: async () => {
      const url = `${api.trades.list.path}?limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch trades");
      return api.trades.list.responses[200].parse(await res.json());
    },
    refetchInterval: FAST_POLL,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: [api.trades.stats.path],
    queryFn: async () => {
      const res = await fetch(api.trades.stats.path);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.trades.stats.responses[200].parse(await res.json());
    },
    refetchInterval: FAST_POLL,
  });
}

// === CONFIGURATION ===

export function useConfig() {
  return useQuery({
    queryKey: [api.config.get.path],
    queryFn: async () => {
      const res = await fetch(api.config.get.path);
      if (!res.ok) throw new Error("Failed to fetch config");
      return api.config.get.responses[200].parse(await res.json());
    },
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await fetch(api.config.update.path, {
        method: api.config.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update config");
      return api.config.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.config.get.path] });
    },
  });
}

// === MARKET DATA ===

export function useMarketHistory(symbol = "BTC/USD") {
  return useQuery({
    queryKey: [api.market.history.path, symbol],
    queryFn: async () => {
      const url = `${api.market.history.path}?symbol=${encodeURIComponent(symbol)}&limit=100`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch market history");
      return api.market.history.responses[200].parse(await res.json());
    },
    refetchInterval: CHART_POLL,
  });
}
