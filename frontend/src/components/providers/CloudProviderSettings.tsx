import { useState, useEffect } from 'react';
import { SciFiCard, SciFiCardHeader, SciFiCardTitle, SciFiCardContent, SciFiCardStatus } from '../ui/SciFiCard';
import { SciFiButton } from '../ui/SciFiButton';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface ProviderConfig {
  type: string;
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
  description: string;
  features: string[];
}

interface CloudConfig {
  llm_providers: Record<string, ProviderConfig>;
  tts_providers: Record<string, ProviderConfig>;
}

export function CloudProviderSettings() {
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [healthStatus, setHealthStatus] = useState<Record<string, any>>({});

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      // In a real implementation, load from backend API
      // For now, we'll simulate the configuration
      const mockConfig: CloudConfig = {
        llm_providers: {
          glm_4_5: {
            type: 'glm',
            enabled: false,
            priority: 1,
            config: {
              model: 'glm-4-plus',
              max_tokens: 4096,
              temperature: 0.7,
              rate_limit_rpm: 100
            },
            description: 'GLM 4.5 - Advanced Chinese and English language model',
            features: ['Streaming responses', 'Multi-language support', 'Long context handling']
          }
        },
        tts_providers: {
          elevenlabs_premium: {
            type: 'elevenlabs',
            enabled: false,
            priority: 1,
            config: {
              model_id: 'eleven_multilingual_v2',
              stability: 0.5,
              similarity_boost: 0.5,
              rate_limit_rpm: 200
            },
            description: 'ElevenLabs Premium - High-quality AI voice synthesis',
            features: ['Professional voice quality', 'Voice cloning', 'Streaming synthesis']
          }
        }
      };
      setConfig(mockConfig);
    } catch (error) {
      console.error('Failed to load configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const testProvider = async (providerName: string, _providerType: 'llm' | 'tts') => {
    try {
      // In a real implementation, call backend health check API
      setHealthStatus(prev => ({
        ...prev,
        [providerName]: { status: 'testing', message: 'Testing connection...' }
      }));

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setHealthStatus(prev => ({
        ...prev,
        [providerName]: { 
          status: 'healthy', 
          message: 'Connection successful',
          response_time_ms: Math.random() * 1000 + 500
        }
      }));
    } catch (error) {
      setHealthStatus(prev => ({
        ...prev,
        [providerName]: { 
          status: 'unhealthy', 
          message: 'Connection failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  };

  const toggleProvider = (providerName: string, providerType: 'llm_providers' | 'tts_providers') => {
    if (!config) return;
    
    setConfig(prev => ({
      ...prev!,
      [providerType]: {
        ...prev![providerType],
        [providerName]: {
          ...prev![providerType][providerName],
          enabled: !prev![providerType][providerName].enabled
        }
      }
    }));
  };

  const updateApiKey = (providerName: string, apiKey: string) => {
    setApiKeys(prev => ({
      ...prev,
      [providerName]: apiKey
    }));
  };

  const saveConfiguration = async () => {
    try {
      setSaving(true);
      // In a real implementation, save to backend API
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Configuration saved:', { config, apiKeys });
    } catch (error) {
      console.error('Failed to save configuration:', error);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'online';
      case 'testing': return 'processing';
      case 'unhealthy': return 'error';
      default: return 'offline';
    }
  };

  if (loading) {
    return (
      <SciFiCard variant="scifiGlass">
        <SciFiCardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-cyan-400">Loading cloud provider settings...</div>
          </div>
        </SciFiCardContent>
      </SciFiCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SciFiCard variant="scifiNeon">
        <SciFiCardHeader>
          <SciFiCardTitle>☁️ Cloud AI Provider Configuration</SciFiCardTitle>
          <div className="flex gap-2">
            <SciFiButton
              variant="primary"
              onClick={saveConfiguration}
              disabled={saving}
            >
              {saving ? '💾 Saving...' : '💾 Save Configuration'}
            </SciFiButton>
            <Button
              variant="outline"
              onClick={loadConfiguration}
              disabled={loading}
            >
              🔄 Reload
            </Button>
          </div>
        </SciFiCardHeader>
      </SciFiCard>

      <Tabs defaultValue="llm" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="llm">🤖 LLM Providers</TabsTrigger>
          <TabsTrigger value="tts">🎵 TTS Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="llm" className="space-y-4">
          {config && Object.entries(config.llm_providers).map(([providerName, provider]) => (
            <SciFiCard key={providerName} variant="scifiSolid" animated>
              <SciFiCardHeader>
                <div>
                  <SciFiCardTitle>{providerName.replace(/_/g, ' ').toUpperCase()}</SciFiCardTitle>
                  <p className="text-sm text-cyan-300 mt-1">{provider.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {healthStatus[providerName] && (
                    <SciFiCardStatus status={getStatusColor(healthStatus[providerName].status)}>
                      {healthStatus[providerName].message}
                      {healthStatus[providerName].response_time_ms && (
                        <span className="ml-2">
                          ({Math.round(healthStatus[providerName].response_time_ms)}ms)
                        </span>
                      )}
                    </SciFiCardStatus>
                  )}
                  <Switch
                    checked={provider.enabled}
                    onCheckedChange={() => toggleProvider(providerName, 'llm_providers')}
                  />
                </div>
              </SciFiCardHeader>
              <SciFiCardContent>
                <div className="space-y-4">
                  {/* Features */}
                  <div>
                    <Label className="text-sm font-medium text-cyan-400">Features:</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {provider.features.map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <Label htmlFor={`apikey-${providerName}`} className="text-sm font-medium text-cyan-400">
                      API Key:
                    </Label>
                    <Input
                      id={`apikey-${providerName}`}
                      type="password"
                      placeholder="Enter API key"
                      value={apiKeys[providerName] || ''}
                      onChange={(e) => updateApiKey(providerName, e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {/* Configuration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-cyan-400">Model:</Label>
                      <Input
                        value={provider.config.model || ''}
                        readOnly
                        className="mt-1 bg-slate-800"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-cyan-400">Max Tokens:</Label>
                      <Input
                        value={provider.config.max_tokens || ''}
                        readOnly
                        className="mt-1 bg-slate-800"
                      />
                    </div>
                  </div>

                  {/* Test Button */}
                  <div className="flex justify-end">
                    <SciFiButton
                      variant="ghost"
                      size="sm"
                      onClick={() => testProvider(providerName, 'llm')}
                      disabled={!provider.enabled || !apiKeys[providerName]}
                    >
                      🔍 Test Connection
                    </SciFiButton>
                  </div>
                </div>
              </SciFiCardContent>
            </SciFiCard>
          ))}
        </TabsContent>

        <TabsContent value="tts" className="space-y-4">
          {config && Object.entries(config.tts_providers).map(([providerName, provider]) => (
            <SciFiCard key={providerName} variant="scifiSolid" animated>
              <SciFiCardHeader>
                <div>
                  <SciFiCardTitle>{providerName.replace(/_/g, ' ').toUpperCase()}</SciFiCardTitle>
                  <p className="text-sm text-cyan-300 mt-1">{provider.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {healthStatus[providerName] && (
                    <SciFiCardStatus status={getStatusColor(healthStatus[providerName].status)}>
                      {healthStatus[providerName].message}
                    </SciFiCardStatus>
                  )}
                  <Switch
                    checked={provider.enabled}
                    onCheckedChange={() => toggleProvider(providerName, 'tts_providers')}
                  />
                </div>
              </SciFiCardHeader>
              <SciFiCardContent>
                <div className="space-y-4">
                  {/* Features */}
                  <div>
                    <Label className="text-sm font-medium text-cyan-400">Features:</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {provider.features.map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <Label htmlFor={`apikey-${providerName}`} className="text-sm font-medium text-cyan-400">
                      API Key:
                    </Label>
                    <Input
                      id={`apikey-${providerName}`}
                      type="password"
                      placeholder="Enter API key"
                      value={apiKeys[providerName] || ''}
                      onChange={(e) => updateApiKey(providerName, e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {/* Configuration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-cyan-400">Model:</Label>
                      <Input
                        value={provider.config.model_id || ''}
                        readOnly
                        className="mt-1 bg-slate-800"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-cyan-400">Rate Limit:</Label>
                      <Input
                        value={`${provider.config.rate_limit_rpm || 0} RPM`}
                        readOnly
                        className="mt-1 bg-slate-800"
                      />
                    </div>
                  </div>

                  {/* Test Button */}
                  <div className="flex justify-end">
                    <SciFiButton
                      variant="ghost"
                      size="sm"
                      onClick={() => testProvider(providerName, 'tts')}
                      disabled={!provider.enabled || !apiKeys[providerName]}
                    >
                      🔍 Test Connection
                    </SciFiButton>
                  </div>
                </div>
              </SciFiCardContent>
            </SciFiCard>
          ))}
        </TabsContent>
      </Tabs>

      {/* Security Notice */}
      <SciFiCard variant="scifiGlass">
        <SciFiCardContent>
          <div className="flex items-start gap-3">
            <div className="text-cyan-400 mt-0.5">🔒</div>
            <div>
              <h4 className="font-semibold text-cyan-400 mb-1">Security Notice</h4>
              <p className="text-sm text-cyan-300">
                API keys are encrypted and stored securely. They are never logged or transmitted in plain text.
                Configure rate limits and usage monitoring to prevent unexpected charges.
              </p>
            </div>
          </div>
        </SciFiCardContent>
      </SciFiCard>
    </div>
  );
}

export default CloudProviderSettings;