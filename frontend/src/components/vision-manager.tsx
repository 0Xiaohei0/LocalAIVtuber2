import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Loader2, Camera, FileText, Image as ImageIcon, AlertCircle, Monitor, Zap, Play, Pause, Clock } from 'lucide-react';
import { Panel } from './panel';
import { chatManager } from '@/lib/chatManager';
import { SidePanel } from './side-panel';

interface MonitorInfo {
  index: number;
  width: number;
  height: number;
  top: number;
  left: number;
  is_primary: boolean;
  description: string;
}

interface ScreenshotResponse {
  success: boolean;
  image: string;
  caption: string;
  extracted_text: string;
  ocr_count: number;
  ocr_results: Array<{
    text: string;
    bbox: number[][];
    confidence: number;
  }>;
  ocr_scale_factor: number;
}

interface VisionManagerProps {
  className?: string;
}

export function VisionManager({ className }: VisionManagerProps) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ScreenshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<number>(1);
  const [loadingMonitors, setLoadingMonitors] = useState(true);
  const [ocrScaleFactor, setOcrScaleFactor] = useState<number>(1);
  const [autoCapture, setAutoCapture] = useState(false);
  const [captureDelay, setCaptureDelay] = useState<number>(0);
  const [requestDuration, setRequestDuration] = useState<number | null>(null);
  const [intervalId, setIntervalId] = useState<number | null>(null);

  // Load monitor information on component mount
  useEffect(() => {
    const loadMonitors = async () => {
      try {
        const res = await fetch('/api/monitors');
        const data = await res.json();

        if (data.monitors) {
          setMonitors(data.monitors);
          // Set primary monitor as default
          const primaryMonitor = data.monitors.find((m: MonitorInfo) => m.is_primary);
          if (primaryMonitor) {
            setSelectedMonitor(primaryMonitor.index);
          }
        }
      } catch (err) {
        console.error('Failed to load monitors:', err);
      } finally {
        setLoadingMonitors(false);
      }
    };

    loadMonitors();
  }, []);

  // Handle auto-capture interval
  useEffect(() => {
    if (autoCapture && !loading) {
      // Use a minimum delay of 100ms to prevent overwhelming the system
      const delayMs = Math.max(captureDelay * 1000, 100);
      
      const id = window.setInterval(() => {
        captureScreenshot();
      }, delayMs);
      setIntervalId(id);

      return () => {
        if (id) {
          clearInterval(id);
        }
      };
    } else if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [autoCapture, captureDelay, loading]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  const captureScreenshot = async () => {
    const startTime = Date.now();
    setLoading(true);

    try {
      const res = await fetch(`/api/screenshot?monitor_index=${selectedMonitor}&ocr_scale_factor=${ocrScaleFactor}`);
      const data = await res.json();

      if (data.success) {
        setResponse(data);
        chatManager.setVisionPrompt(data.caption);
        chatManager.setOcrPrompt(data.extracted_text);
      } else {
        setError(data.error || 'Failed to capture screenshot');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture screenshot');
    } finally {
      const endTime = Date.now();
      setRequestDuration(endTime - startTime);
      setLoading(false);
    }
  };

  const toggleAutoCapture = () => {
    setAutoCapture(!autoCapture);
  };

  // Calculate scaled resolution based on selected monitor and scale factor
  const getScaledResolution = () => {
    const selectedMonitorInfo = monitors.find(m => m.index === selectedMonitor);
    if (!selectedMonitorInfo) return null;

    return {
      width: Math.round(selectedMonitorInfo.width * ocrScaleFactor),
      height: Math.round(selectedMonitorInfo.height * ocrScaleFactor)
    };
  };

  const scaledResolution = getScaledResolution();

  return (
    <div className="relative overflow-hidden h-screen">
      <div>
        <SidePanel isOpen={true}>
          {/* Monitor Selection */}
          <div className="space-y-2 w-full overflow-hidden">
            <label className="text-sm font-medium flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Select Monitor
            </label>
            {loadingMonitors ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading monitors...
              </div>
            ) : (
              <Select value={selectedMonitor.toString()} onValueChange={(value) => setSelectedMonitor(parseInt(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a monitor" />
                </SelectTrigger>
                <SelectContent>
                  {monitors.map((monitor) => (
                    <SelectItem key={monitor.index} value={monitor.index.toString()}>
                      {monitor.description}
                      {monitor.is_primary && " (Primary)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* OCR Scale Factor */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              OCR Scale Factor
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0.1"
                max="1.0"
                step="0.1"
                value={ocrScaleFactor}
                onChange={(e) => setOcrScaleFactor(parseFloat(e.target.value) || 0.5)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                ({Math.round(ocrScaleFactor * 100)}% of original size)
              </span>
            </div>
            {scaledResolution && (
              <div className="text-xs text-muted-foreground">
                <p>Lower values = faster processing, higher values = better accuracy</p>
                <p>Scaled resolution: {scaledResolution.width} × {scaledResolution.height}</p>
              </div>
            )}
          </div>

          {/* Auto-Capture Settings */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Auto-Capture Settings
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Delay:</span>
              <Input
                type="number"
                min="0.1"
                max="1000"
                step="0.1"
                value={captureDelay}
                onChange={(e) => setCaptureDelay(parseFloat(e.target.value) || 0)}
                className="w-16"
                disabled={autoCapture}
              />
              <span className="text-sm text-muted-foreground">seconds</span>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Time to wait after each screenshot before taking the next one</p>
            </div>
          </div>
        </SidePanel>
      </div>
      <div className="max-w-4xl mx-auto flex flex-col gap-4 pt-4">
        <Panel>
          <div className="space-y-4">


            {/* Capture Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={captureScreenshot}
                disabled={loading || loadingMonitors || autoCapture}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Capture Screenshot
                  </>
                )}
              </Button>

              <Button
                onClick={toggleAutoCapture}
                variant={autoCapture ? "destructive" : "secondary"}
              >
                {autoCapture ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Stop Auto
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Auto
                  </>
                )}
              </Button>
            </div>

            {autoCapture && (
              <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                <p>Auto-capture is running. Taking screenshots every {captureDelay === 0 ? '0.1' : captureDelay} seconds.</p>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="overflow-y-scroll scrollbar-hide h-[80vh]">
          {error && (
            <Panel className="border-destructive">
              <div className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="mt-2 text-sm text-destructive">{error}</p>
              </div>
            </Panel>
          )}

          {response && (
            <div className={`space-y-6 ${className}`}>
              {/* Screenshot Image */}
              <div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Screenshot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <img
                      src={`data:image/png;base64,${response.image}`}
                      alt="Screenshot"
                      className="w-full max-w-full rounded-lg border shadow-sm"
                    />
                    <Badge className="absolute top-2 right-2 bg-black/70 text-white">
                      {response.ocr_count} text regions
                    </Badge>
                  </div>
                </CardContent>
              </div>

              {/* Image Caption */}
              {response.caption && (
                <div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Image Caption
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{response.caption}</p>
                  </CardContent>
                </div>
              )}

              {/* Extracted Text */}
              {response.extracted_text && (
                <div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Extracted Text
                    </CardTitle>
                    <CardDescription>
                      {response.ocr_count} text regions detected
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-sm whitespace-pre-wrap">{response.extracted_text}</p>
                      </div>

                      {/* {response.ocr_results.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3">Detailed OCR Results</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {response.ocr_results.map((result, index) => (
                              <div key={index} className="flex items-center justify-between p-2 rounded border">
                                <span className="text-sm font-medium">{result.text}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant={result.confidence > 0.8 ? "default" : "secondary"}>
                                    {formatConfidence(result.confidence)}
                                  </Badge>
                                  {result.confidence > 0.8 && (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )} */}
                    </div>
                  </CardContent>
                </div>
              )}

              {/* Response Metadata */}
              <div>
                <CardHeader>
                  <CardTitle>Response Details</CardTitle>
                </CardHeader>
                <div>
                  <div className="grid grid-cols-2 gap-4 text-sm p-5">
                    <div>
                      <span className="font-medium">Status:</span>
                      <Badge variant="default" className="ml-2">
                        Success
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">OCR Regions:</span>
                      <span className="ml-2">{response.ocr_count}</span>
                    </div>
                    <div>
                      <span className="font-medium">OCR Scale Factor:</span>
                      <span className="ml-2">{Math.round(response.ocr_scale_factor * 100)}%</span>
                    </div>
                    <div>
                      <span className="font-medium">Has Caption:</span>
                      <span className="ml-2">{response.caption ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <span className="font-medium">Original Resolution:</span>
                      <span className="ml-2">
                        {(() => {
                          const selectedMonitorInfo = monitors.find(m => m.index === selectedMonitor);
                          return selectedMonitorInfo ? `${selectedMonitorInfo.width} × ${selectedMonitorInfo.height}` : 'N/A';
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Scaled Resolution:</span>
                      <span className="ml-2">{scaledResolution ? `${scaledResolution.width} × ${scaledResolution.height}` : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium">Has Text:</span>
                      <span className="ml-2">{response.extracted_text ? 'Yes' : 'No'}</span>
                    </div>
                    <div>
                      <span className="font-medium">Request Time:</span>
                      <span className="ml-2">
                        {requestDuration ? `${requestDuration}ms` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
