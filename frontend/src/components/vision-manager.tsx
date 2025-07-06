import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Loader2, Camera, FileText, Image as ImageIcon, AlertCircle, CheckCircle, Monitor } from 'lucide-react';

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

  const captureScreenshot = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`/api/screenshot?monitor_index=${selectedMonitor}`);
      const data = await res.json();

      if (data.success) {
        setResponse(data);
      } else {
        setError(data.error || 'Failed to capture screenshot');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture screenshot');
    } finally {
      setLoading(false);
    }
  };

  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Vision Manager
          </CardTitle>
          <CardDescription>
            Capture screenshots and analyze content with OCR and image captioning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Monitor Selection */}
          <div className="space-y-2">
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
                <SelectTrigger>
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

          {/* Capture Button */}
          <Button 
            onClick={captureScreenshot} 
            disabled={loading || loadingMonitors}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Capturing Screenshot...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Capture Screenshot
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-2 text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {response && (
        <div className="space-y-6">
          {/* Screenshot Image */}
          <Card>
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
          </Card>

          {/* Image Caption */}
          {response.caption && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Image Caption
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{response.caption}</p>
              </CardContent>
            </Card>
          )}

          {/* Extracted Text */}
          {response.extracted_text && (
            <Card>
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
                  
                  {response.ocr_results.length > 0 && (
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
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Response Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Response Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
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
                  <span className="font-medium">Has Caption:</span>
                  <span className="ml-2">{response.caption ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <span className="font-medium">Has Text:</span>
                  <span className="ml-2">{response.extracted_text ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
