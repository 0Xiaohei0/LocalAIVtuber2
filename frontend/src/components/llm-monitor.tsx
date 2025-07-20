import { useEffect, useState } from 'react';
import { chatManager } from '@/lib/chatManager';
import { CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

export function LLMMonitor() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [visionPrompt, setVisionPrompt] = useState('');
  const [ocrPrompt, setOcrPrompt] = useState('');
  const [currentImage, setCurrentImage] = useState('');
  const [retrievedContext, setRetrievedContext] = useState('');
  const [fullSystemPrompt, setFullSystemPrompt] = useState('');

  useEffect(() => {
    // Subscribe to chat manager updates with specific change types
    const unsubscribe = chatManager.subscribe(() => {
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

    // Initial values
    setSystemPrompt(chatManager.getSystemPrompt());
    setVisionPrompt(chatManager.getVisionPrompt());
    setOcrPrompt(chatManager.getOcrPrompt());
    setCurrentImage(chatManager.getCurrentImage());
    setRetrievedContext(chatManager.getRetrievedContext());
    setFullSystemPrompt(chatManager.getFullSystemPrompt());

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full">
      <CardHeader>
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
            <h3 className="font-medium mb-2">System Prompt</h3>
            <Textarea disabled className="h-fit w-full rounded-md border p-2" placeholder="No system prompt set" value={systemPrompt} />
          </div>

          <div>
            <h3 className="font-medium mb-2">Vision Prompt</h3>
            <Textarea disabled className="h-fit w-full rounded-md border p-2" placeholder="No vision context" value={visionPrompt} />
          </div>

          <div>
            <h3 className="font-medium mb-2">OCR Prompt</h3>
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
