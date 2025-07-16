import { useEffect, useState } from 'react';
import { chatManager } from '@/lib/chatManager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';

export function LLMMonitor() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [visionPrompt, setVisionPrompt] = useState('');
  const [ocrPrompt, setOcrPrompt] = useState('');

  useEffect(() => {
    // Subscribe to chat manager updates
    const unsubscribe = chatManager.subscribe(() => {
      setSystemPrompt(chatManager.getSystemPrompt());
      setVisionPrompt(chatManager.getVisionPrompt());
      setOcrPrompt(chatManager.getOcrPrompt());
    });

    // Initial values
    setSystemPrompt(chatManager.getSystemPrompt());
    setVisionPrompt(chatManager.getVisionPrompt());
    setOcrPrompt(chatManager.getOcrPrompt());

    return () => unsubscribe();
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>LLM Monitor</CardTitle>
        <CardDescription>Current prompts and context</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">System Prompt</h3>
            <Textarea className="h-24 w-full rounded-md border p-2" placeholder="No system prompt set" value={systemPrompt} />
          </div>

          <div>
            <h3 className="font-medium mb-2">Vision Prompt</h3>
            <Textarea className="h-24 w-full rounded-md border p-2" placeholder="No vision context" value={visionPrompt} />
          </div>

          <div>
            <h3 className="font-medium mb-2">OCR Prompt</h3>
            <Textarea className="h-24 w-full rounded-md border p-2" placeholder="No OCR context" value={ocrPrompt} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
