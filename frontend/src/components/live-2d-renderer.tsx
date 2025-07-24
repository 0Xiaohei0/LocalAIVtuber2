import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';
import { globalStateManager } from "@/lib/globalStateManager";

declare global {
  interface Window {
    PIXI: typeof PIXI;
  }
}

interface Live2DCanvasProps {
  modelPath: string;
  xPosition: number; // 0-100 percentage
  yPosition: number; // 0-100 percentage  
  scale: number; // 0.1-3.0 scale factor
}

const Live2DCanvas: React.FC<Live2DCanvasProps> = ({ modelPath, xPosition, yPosition, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<Live2DModel>(null);

  // Function to update model position and scale
  const updateModelTransform = () => {
    if (modelRef.current) {
      // Convert percentage to pixel position
      modelRef.current.x = (xPosition / 100) * window.innerWidth;
      modelRef.current.y = (yPosition / 100) * window.innerHeight;
      modelRef.current.scale.set(scale, scale);
    }
  };

  useEffect(() => {
    // Expose PIXI for live2d-display
    window.PIXI = PIXI;

    if (!canvasRef.current) return;

    const app = new PIXI.Application({
      view: canvasRef.current,
      resizeTo: window,
      backgroundAlpha: 0
    });
    appRef.current = app;

    (async () => {
      try {
        const model = Live2DModel.fromSync(modelPath, { onError: console.warn, autoInteract: false });
        model.once('load', async () => {
            // Set initial position and scale using props
            model.x = (xPosition / 100) * window.innerWidth;
            model.y = (yPosition / 100) * window.innerHeight;
            model.scale.set(scale, scale);
            model.anchor.set(0.5, 0.5);
            app.stage.addChild(model);
            modelRef.current = model;

            console.log(model)
            app.ticker.add(() => {
              if (modelRef.current) {
                const volume = globalStateManager.getState("ttsLiveVolume");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (modelRef.current.internalModel.coreModel as any).setParameterValueById(
                  "ParamMouthOpen",
                  volume
                );
              }
            });
          });

      } catch (err) {
        console.error('Failed to load Live2D model:', err);
      }
    })();

  }, [modelPath]);

  // Update model transform when position or scale props change
  useEffect(() => {
    updateModelTransform();
  }, [xPosition, yPosition, scale]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      updateModelTransform();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [xPosition, yPosition, scale]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export default Live2DCanvas;
