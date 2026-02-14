import { useState, useEffect } from 'react';
import { SciFiCard, SciFiCardHeader, SciFiCardTitle, SciFiCardContent, SciFiCardStatus } from './ui/SciFiCard';
import { SciFiButton } from './ui/SciFiButton';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface PerformanceStats {
  system: {
    memory: {
      rss_mb: number;
      vms_mb: number;
      percent: number;
      available_mb: number;
    };
    gc_stats: any;
  };
  llm: {
    model_load_times: Record<string, number>;
    model_memory_usage: Record<string, number>;
    current_model: string;
  };
  tts: {
    current_voice: string;
    synthesis_times: Record<string, number>;
    cache_enabled: boolean;
  };
  cache: {
    total_entries: number;
    active_entries: number;
    expired_entries: number;
    cache_hit_ratio: number;
  };
  uptime: number;
}

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/performance/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch performance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerOptimization = async () => {
    try {
      setOptimizing(true);
      const response = await fetch('/api/performance/optimize', { method: 'POST' });
      const result = await response.json();
      console.log('Optimization result:', result);
      // Refresh stats after optimization
      await fetchStats();
    } catch (error) {
      console.error('Failed to trigger optimization:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const clearCache = async () => {
    try {
      const response = await fetch('/api/performance/cache/clear', { method: 'POST' });
      if (response.ok) {
        await fetchStats();
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const formatMemory = (mb: number) => {
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${mb.toFixed(1)}MB`;
  };

  const getMemoryStatus = (percent: number) => {
    if (percent > 80) return 'error';
    if (percent > 60) return 'warning';
    return 'online';
  };

  if (!stats) {
    return (
      <SciFiCard variant="scifiGlass">
        <SciFiCardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-cyan-400">Loading performance data...</div>
          </div>
        </SciFiCardContent>
      </SciFiCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <SciFiCard variant="scifiNeon">
        <SciFiCardHeader>
          <SciFiCardTitle>⚡ Performance Monitor</SciFiCardTitle>
          <div className="flex items-center gap-3">
            <SciFiCardStatus status="online">
              Uptime: {formatUptime(stats.uptime)}
            </SciFiCardStatus>
            <div className="flex gap-2">
              <SciFiButton
                variant="scifiGhost"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? '⏸️ Pause' : '▶️ Auto'}
              </SciFiButton>
              <SciFiButton
                variant="ghost"
                size="sm"
                onClick={fetchStats}
                disabled={loading}
              >
                🔄 Refresh
              </SciFiButton>
            </div>
          </div>
        </SciFiCardHeader>
        <SciFiCardContent>
          <div className="flex gap-3">
            <SciFiButton
              variant="primary"
              onClick={triggerOptimization}
              disabled={optimizing}
              className="flex-1"
            >
              {optimizing ? '⚡ Optimizing...' : '🚀 Optimize Performance'}
            </SciFiButton>
            <SciFiButton
              variant="danger"
              onClick={clearCache}
              size="default"
            >
              🗑️ Clear Cache
            </SciFiButton>
          </div>
        </SciFiCardContent>
      </SciFiCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Memory */}
        <SciFiCard variant="scifiSolid">
          <SciFiCardHeader>
            <SciFiCardTitle>🧠 Memory Usage</SciFiCardTitle>
            <SciFiCardStatus status={getMemoryStatus(stats.system.memory.percent)}>
              {stats.system.memory.percent.toFixed(1)}%
            </SciFiCardStatus>
          </SciFiCardHeader>
          <SciFiCardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>RSS Memory</span>
                  <span>{formatMemory(stats.system.memory.rss_mb)}</span>
                </div>
                <Progress 
                  value={stats.system.memory.percent} 
                  className="h-2 bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-cyan-400 font-mono">VMS:</div>
                  <div>{formatMemory(stats.system.memory.vms_mb)}</div>
                </div>
                <div>
                  <div className="text-cyan-400 font-mono">Available:</div>
                  <div>{formatMemory(stats.system.memory.available_mb)}</div>
                </div>
              </div>
            </div>
          </SciFiCardContent>
        </SciFiCard>

        {/* Cache Statistics */}
        <SciFiCard variant="scifiSolid">
          <SciFiCardHeader>
            <SciFiCardTitle>💾 Cache Performance</SciFiCardTitle>
            <SciFiCardStatus status={stats.cache.total_entries > 0 ? "online" : "offline"}>
              {stats.cache.active_entries} Active
            </SciFiCardStatus>
          </SciFiCardHeader>
          <SciFiCardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-cyan-400 font-mono">Total:</div>
                  <div>{stats.cache.total_entries}</div>
                </div>
                <div>
                  <div className="text-cyan-400 font-mono">Expired:</div>
                  <div className="text-red-400">{stats.cache.expired_entries}</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Hit Ratio</span>
                  <span>{(stats.cache.cache_hit_ratio * 100).toFixed(1)}%</span>
                </div>
                <Progress 
                  value={stats.cache.cache_hit_ratio * 100} 
                  className="h-2 bg-slate-800"
                />
              </div>
            </div>
          </SciFiCardContent>
        </SciFiCard>

        {/* LLM Performance */}
        <SciFiCard variant="scifiSolid">
          <SciFiCardHeader>
            <SciFiCardTitle>🤖 LLM Performance</SciFiCardTitle>
            <SciFiCardStatus status="online">
              {stats.llm.current_model || 'No Model'}
            </SciFiCardStatus>
          </SciFiCardHeader>
          <SciFiCardContent>
            <div className="space-y-3">
              {Object.entries(stats.llm.model_load_times || {}).map(([model, time]) => (
                <div key={model} className="flex justify-between items-center text-sm">
                  <span className="truncate font-mono">{model}</span>
                  <Badge variant="outline" className="text-xs">
                    {time.toFixed(2)}s
                  </Badge>
                </div>
              ))}
              {Object.keys(stats.llm.model_load_times || {}).length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No model performance data
                </div>
              )}
            </div>
          </SciFiCardContent>
        </SciFiCard>

        {/* TTS Performance */}
        <SciFiCard variant="scifiSolid">
          <SciFiCardHeader>
            <SciFiCardTitle>🎵 TTS Performance</SciFiCardTitle>
            <SciFiCardStatus status="online">
              {stats.tts.current_voice || 'No Voice'}
            </SciFiCardStatus>
          </SciFiCardHeader>
          <SciFiCardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span>Cache:</span>
                <Badge variant={stats.tts.cache_enabled ? "default" : "secondary"}>
                  {stats.tts.cache_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              {Object.entries(stats.tts.synthesis_times || {}).map(([voice, time]) => (
                <div key={voice} className="flex justify-between items-center text-sm">
                  <span className="truncate font-mono">{voice}</span>
                  <Badge variant="outline" className="text-xs">
                    {time.toFixed(2)}s
                  </Badge>
                </div>
              ))}
              {Object.keys(stats.tts.synthesis_times || {}).length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No synthesis performance data
                </div>
              )}
            </div>
          </SciFiCardContent>
        </SciFiCard>
      </div>
    </div>
  );
}

export default PerformanceMonitor;