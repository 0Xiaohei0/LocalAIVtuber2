import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display';

declare global {
  interface Window {
    PIXI: typeof PIXI;
  }
}

interface Live2DCanvasProps {
  modelPath: string;
}

const Live2DCanvas: React.FC<Live2DCanvasProps> = ({ modelPath }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  
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
        model.once('load', () => {
            model.x = window.innerWidth / 2;
            model.y = window.innerHeight;
            model.scale.set(0.3, 0.3);
            model.anchor.set(0.5, 0.5);
            app.stage.addChild(model);
            console.log(model)
        });


      } catch (err) {
        console.error('Failed to load Live2D model:', err);
      }
    })();

  }, [modelPath]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export default Live2DCanvas;
