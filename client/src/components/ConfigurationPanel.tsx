import { useConfig, useUpdateConfig } from "@/hooks/use-financial-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertConfigSchema } from "@shared/schema";
import { useEffect } from "react";
import { Play, Pause, Save, Settings2, RefreshCcw } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Extend schema for form validation if needed
const formSchema = insertConfigSchema.extend({
  tpPercentage: z.coerce.number().min(0.01).max(5),
  maxHoldSeconds: z.coerce.number().min(30).max(3600),
  cooldownSeconds: z.coerce.number().min(1).max(60),
  dailyLossLimit: z.coerce.number().min(0.1).max(50),
});

type ConfigFormValues = z.infer<typeof formSchema>;

export function ConfigurationPanel() {
  const { data: config, isLoading } = useConfig();
  const updateMutation = useUpdateConfig();
  const { toast } = useToast();

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tpPercentage: 0.12,
      maxHoldSeconds: 300,
      cooldownSeconds: 5,
      dailyLossLimit: 5.0,
      isRunning: false,
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        tpPercentage: Number(config.tpPercentage),
        maxHoldSeconds: config.maxHoldSeconds,
        cooldownSeconds: config.cooldownSeconds,
        dailyLossLimit: Number(config.dailyLossLimit),
        isRunning: config.isRunning,
      });
    }
  }, [config, form]);

  const onSubmit = (data: ConfigFormValues) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Configuration Saved",
          description: "Trading parameters updated successfully.",
        });
      },
    });
  };

  const toggleRunning = () => {
    const currentState = form.getValues("isRunning");
    updateMutation.mutate({ isRunning: !currentState }, {
      onSuccess: () => {
        const newState = !currentState;
        form.setValue("isRunning", newState);
        toast({
          title: newState ? "Engine Started" : "Engine Stopped",
          description: newState ? "Trading strategy is now active." : "Trading strategy has been paused.",
          variant: newState ? "default" : "destructive",
        });
      }
    });
  };

  if (isLoading) return <div className="animate-pulse h-48 bg-secondary/20 rounded-xl" />;

  const isRunning = form.watch("isRunning");

  return (
    <div className="glass-panel rounded-xl p-6 border-t-4 border-t-primary/20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Strategy Configuration</h3>
            <p className="text-muted-foreground text-xs">Adjust continuous profit engine parameters</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-white/5">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", isRunning ? "bg-emerald-500" : "bg-rose-500")} />
            <span className="text-xs font-mono uppercase tracking-wider font-bold">
              {isRunning ? "Engine Active" : "Engine Stopped"}
            </span>
          </div>
          
          <Button 
            size="lg"
            variant={isRunning ? "destructive" : "default"}
            className={cn("w-40 font-bold shadow-lg transition-all", isRunning ? "shadow-rose-900/20" : "shadow-emerald-900/20 hover:scale-105")}
            onClick={toggleRunning}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
            ) : isRunning ? (
              <><Pause className="w-4 h-4 mr-2" /> STOP ENGINE</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> START ENGINE</>
            )}
          </Button>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <div className="flex justify-between">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Take Profit Target</Label>
            <span className="text-primary font-mono-numbers font-bold text-sm">{form.watch("tpPercentage")}%</span>
          </div>
          <Controller
            control={form.control}
            name="tpPercentage"
            render={({ field }) => (
              <Slider 
                min={0.05} 
                max={1.0} 
                step={0.01} 
                value={[Number(field.value)]} 
                onValueChange={(val) => field.onChange(val[0])}
                className="py-2"
              />
            )}
          />
          <p className="text-[10px] text-muted-foreground">Fixed percentage target for immediate exit upon reaching profit.</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Max Hold Time</Label>
            <span className="text-white font-mono-numbers font-bold text-sm">{form.watch("maxHoldSeconds")}s</span>
          </div>
          <Controller
            control={form.control}
            name="maxHoldSeconds"
            render={({ field }) => (
              <Slider 
                min={60} 
                max={600} 
                step={30} 
                value={[Number(field.value)]} 
                onValueChange={(val) => field.onChange(val[0])}
                className="py-2"
              />
            )}
          />
          <p className="text-[10px] text-muted-foreground">Mandatory time-based exit regardless of profit/loss status.</p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Cooldown Period</Label>
            <span className="text-white font-mono-numbers font-bold text-sm">{form.watch("cooldownSeconds")}s</span>
          </div>
          <Controller
            control={form.control}
            name="cooldownSeconds"
            render={({ field }) => (
              <Slider 
                min={2} 
                max={30} 
                step={1} 
                value={[Number(field.value)]} 
                onValueChange={(val) => field.onChange(val[0])}
                className="py-2"
              />
            )}
          />
          <p className="text-[10px] text-muted-foreground">Wait time between closing a trade and scanning for re-entry.</p>
        </div>

        <div className="flex flex-col justify-end">
          <Button type="submit" variant="secondary" className="w-full" disabled={updateMutation.isPending || isRunning}>
            <Save className="w-4 h-4 mr-2" /> 
            Apply Changes
          </Button>
          <p className="text-[10px] text-muted-foreground mt-2 text-center opacity-70">
            {isRunning ? "Stop engine to modify settings" : "Changes apply to next trade"}
          </p>
        </div>
      </form>
    </div>
  );
}
