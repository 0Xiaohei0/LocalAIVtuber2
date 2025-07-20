import { useEffect, useState } from 'react';
import { chatManager } from '@/lib/chatManager';
import { globalStateManager } from '@/lib/globalStateManager';
import { CardContent, CardHeader } from './ui/card';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Mic, MicOff, Camera, CameraOff } from 'lucide-react';

export function LLMMonitor() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [visionPrompt, setVisionPrompt] = useState('');
  const [ocrPrompt, setOcrPrompt] = useState('');
  const [currentImage, setCurrentImage] = useState('');
  const [retrievedContext, setRetrievedContext] = useState('');
  const [fullSystemPrompt, setFullSystemPrompt] = useState('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isAutoCapture, setIsAutoCapture] = useState(false);
  
  // useEffect(() => {
  //   console.log(isVoiceRecording);
  // }, [isVoiceRecording]);

  useEffect(() => {
    // Subscribe to chat manager updates with specific change types
    const unsubscribeChat = chatManager.subscribe(() => {
      setSystemPrompt(chatManager.getSystemPrompt());
      setVisionPrompt(chatManager.getVisionPrompt());
      setOcrPrompt(chatManager.getOcrPrompt());
      setCurrentImage(chatManager.getCurrentImage());
      setRetrievedContext(chatManager.getRetrievedContext());
      setFullSystemPrompt(chatManager.getFullSystemPrompt());
    }, {
      onSystemPromptChange: true,
      onVisionPromptChange: true,
      onOcrPromptChange: true,
      onImageChange: true,
      onContextChange: true,
      onFullSystemPromptChange: true
    });

    // Subscribe to global state updates
    const unsubscribeVoice = globalStateManager.subscribe('isVoiceRecording', (recording) => {
      setIsVoiceRecording(recording);
    });

    const unsubscribeCapture = globalStateManager.subscribe('isAutoCapture', (capture) => {
      setIsAutoCapture(capture);
    });

    // Initial values
    setSystemPrompt(chatManager.getSystemPrompt());
    setVisionPrompt(chatManager.getVisionPrompt());
    setOcrPrompt(chatManager.getOcrPrompt());
    setCurrentImage(chatManager.getCurrentImage());
    setRetrievedContext(chatManager.getRetrievedContext());
    setFullSystemPrompt(chatManager.getFullSystemPrompt());
    setIsVoiceRecording(globalStateManager.getState('isVoiceRecording'));
    setIsAutoCapture(globalStateManager.getState('isAutoCapture'));

    return () => {
      unsubscribeChat();
      unsubscribeVoice();
      unsubscribeCapture();
    };
  }, []);

  const toggleVoiceRecording = () => {
    globalStateManager.updateState('isVoiceRecording', !isVoiceRecording);
  };

  const toggleAutoCapture = () => {
    globalStateManager.updateState('isAutoCapture', !isAutoCapture);
  };

  return (
    <div className="w-full">
      <CardHeader>
        <div className="flex gap-2 mb-4">
          <Button
            onClick={toggleVoiceRecording}
            variant={isVoiceRecording ? "default" : "outline"}
            className="w-40"
            size="sm"
          >
            {isVoiceRecording ? (
              <>
                <MicOff className="mr-2 h-4 w-4" />
                Stop Mic
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Start Mic
              </>
            )}
          </Button>
          
          <Button
            onClick={toggleAutoCapture}
            variant={isAutoCapture ? "default" : "outline"}
            className="w-40"
            size="sm"
          >
            {isAutoCapture ? (
              <>
                <CameraOff className="mr-2 h-4 w-4" />
                Stop Vision
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Start Vision
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {currentImage && (
            <div>
              <h3 className="font-medium mb-2">Current Vision Input</h3>
              <div className="relative">
                <img
                  src={`data:image/png;base64,${currentImage}`}
                  alt="Current vision input"
                  className="w-full max-w-full rounded-lg border shadow-sm"
                />
              </div>
            </div>
          )}

          <div>
            <h3 className="font-medium mb-2">System Context</h3>
            <Textarea disabled className="h-fit w-full rounded-md border p-2" placeholder="No system prompt set" value={systemPrompt} />
          </div>

          <div>
            <h3 className="font-medium mb-2">Vision Context</h3>
            <Textarea disabled className="h-fit w-full rounded-md border p-2" placeholder="No vision context" value={visionPrompt} />
          </div>

          <div>
            <h3 className="font-medium mb-2">OCR Context</h3>
            <Textarea disabled className="h-fit w-full rounded-md border p-2" placeholder="No OCR context" value={ocrPrompt} />
          </div>

          <Separator className="my-4" />
          
          <div>
            <h3 className="font-medium mb-2">Retrieved Memory Context</h3>
            <div className="relative">
              <Textarea 
                disabled
                className="h-fit w-full rounded-md border p-2" 
                placeholder="No context retrieved from memory" 
                value={retrievedContext}
              />
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              Full System Prompt
            </h3>
            <div className="relative">
              <Textarea 
                disabled
                className="h-fit w-full rounded-md border p-2 bg-muted" 
                placeholder="No system prompt composed yet" 
                value={fullSystemPrompt}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
