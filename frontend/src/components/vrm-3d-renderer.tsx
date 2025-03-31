import React, { useEffect, useRef} from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { createVRMAnimationClip, VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';
import { VRM } from '@pixiv/three-vrm';

// const CHARACTER_MODEL_PATH = "src/assets/VRM3D/models/生駒ミル_私服.vrm"

const CHARACTER_MODEL_PATH = "src/assets/VRM3D/models/春日部つむぎハイパー.vrm"
const ANIMATIONS = {
    DEFAULT: { idle: "src/assets/VRM3D/animations/idle.vrma", gestures: [] },
}

const BACKGROUND_IMAGE = "src/assets/black.png" 

const VRM3dCanvas = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const gltfLoaderRef = useRef<GLTFLoader>(new GLTFLoader());  // Ref for GLTFLoader
  const mainAnimationRef = useRef<THREE.AnimationAction | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);

  const speakAnimationRef = useRef<THREE.AnimationAction | null>(null);
  const blinkAnimationRef = useRef<THREE.AnimationAction | null>(null);

  const idleAnimationFileNameRef = useRef<string | null>(null);
  const lastPlayedGestureRef = useRef<THREE.AnimationAction | null>(null);

  const [isSpeaking, setIsSpeaking]  = React.useState(false);
  const canClickRef = useRef<boolean>(true);

//   const [lastInteractionTime, setLastInteractionTime] = React.useState(Date.now());
//   const idleTime = 30000;
//   const canPlayIdleAnimRef = useRef<boolean>(true);

  // scene objects
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const backgroundTextureRef = useRef<THREE.Texture | null>(null);


  // constants
  const companionModeCameraPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.7, 2.2));
  const companionModeCameraLookatRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.2, 0));


  // for playing idle animations
//   useEffect(() => {
//     const interval = setInterval(() => {
//       if (Date.now() - lastInteractionTime >= idleTime) {
//         const randIdx = Math.floor(Math.random() * ANIMATIONS.IDLE.gestures.length);
//         if (canPlayIdleAnimRef.current) {
//           loadAndPlayAnimation({ filename: ANIMATIONS.IDLE.gestures[randIdx], animationType: AnimationType.Gesture, overridable: true });
//         }
//       }
//     }, 1000);

//     return () => clearInterval(interval);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [lastInteractionTime]);

  // for speak animation
  useEffect(() => {
    if (isSpeaking) {
      speakAnimationRef.current?.play();
    } else {
      speakAnimationRef.current?.stop();
    }
  }, [isSpeaking]);

  // Initialization
  useEffect(() => {
    const scene = new THREE.Scene();
    const mountNode = mountRef.current; // Copy the ref value to a local variable

    // load background image
    const loader = new THREE.TextureLoader();
    loader.load(BACKGROUND_IMAGE, function (texture) {
      texture.minFilter = THREE.LinearFilter;
      scene.background = texture;
      backgroundTextureRef.current = texture;
      updateBackground();
    });

    function updateBackground(): void {
      // When factor larger than 1, that means texture 'wilder' than target。 
      // we should scale texture height to target height and then 'map' the center  of texture to target， and vice versa.
      const targetAspect = window.innerWidth / window.innerHeight;
      const imageAspect = backgroundTextureRef.current?.image.width / backgroundTextureRef.current?.image.height;
      const factor = imageAspect / targetAspect;
      if (scene.background instanceof THREE.Texture) {
        scene.background.offset.x = factor > 1 ? (1 - 1 / factor) / 2 : 0;
        scene.background.repeat.x = factor > 1 ? 1 / factor : 1;
        scene.background.offset.y = factor > 1 ? 0 : (1 - factor) / 2;
        scene.background.repeat.y = factor > 1 ? 1 : factor;
      }
    }

    const camera = new THREE.PerspectiveCamera(
      30,
      (mountNode?.clientWidth || window.innerWidth) / (mountNode?.clientHeight || window.innerHeight),
      0.1,
      1000
    );
    cameraRef.current = camera;

    let parameters = null;
    parameters = { antialias: true }
    const renderer = new THREE.WebGLRenderer(parameters);

    renderer.autoClear = false;
    renderer.setSize(mountNode?.clientWidth || window.innerWidth, mountNode?.clientHeight || window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current?.appendChild(renderer.domElement);
    camera.position.copy(companionModeCameraPositionRef.current);
    renderer.setClearColor(0x99ddff);
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.target.copy(companionModeCameraLookatRef.current.clone());
    controls.update();

    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 5, 3);
    scene.add(directionalLight);

    gltfLoaderRef.current.register((parser) => new VRMLoaderPlugin(parser));
    gltfLoaderRef.current.register((parser) => new VRMAnimationLoaderPlugin(parser));

    const initVRMScene = async () => {
      const gltfVrm = await gltfLoaderRef.current.loadAsync(CHARACTER_MODEL_PATH);
      const vrm: VRM = gltfVrm.userData.vrm;
      console.log(vrm)
      vrmRef.current = vrm; // Store the VRM for future reference
      VRMUtils.rotateVRM0(vrm);
      VRMUtils.removeUnnecessaryVertices(vrm.scene);
      vrm.scene.traverse((obj: THREE.Object3D) => obj.frustumCulled = false);
      if (!vrm.lookAt) return
      const lookAtQuatProxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
      lookAtQuatProxy.name = 'lookAtQuaternionProxy';
      vrm.scene.add(lookAtQuatProxy);
      const lookAtTarget = new THREE.Object3D();
      camera.add(lookAtTarget);
      vrm.lookAt.target = lookAtTarget;
      scene.add(vrm.scene);
      mixerRef.current = new THREE.AnimationMixer(vrm.scene);
      clockRef.current = new THREE.Clock();

      vrm.scene.position.set(0, 0, 0);
      vrm.springBoneManager?.reset();

      loadAndPlayAnimation({ filename: ANIMATIONS.DEFAULT.idle, animationType: AnimationType.Idle, fadeDuration: 0, override: true });

      //setup speak animation
      if (!vrm.expressionManager) {
        console.error("vrm.expressionManager is null");
        return;
      }
      const speakExpressionTrackName = vrm.expressionManager.getExpressionTrackName('aa');
      if (!speakExpressionTrackName) {
        console.error("Expression track name for 'aa' is null");
        return;
      }
      const speakTrack = new THREE.NumberKeyframeTrack(
        speakExpressionTrackName, // name
        [0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.9], // times
        [0.0, 0.3, 0.0, 0.3, 0.1, 0.1, 0.3, 0.1, 0.1, 0.2] // values
      );
      let clip = new THREE.AnimationClip('Animation', 1.9, [speakTrack]);
      speakAnimationRef.current = mixerRef.current?.clipAction(clip)
      setIsSpeaking(true);
      const blinkInterval = 2
      if (!vrm.expressionManager) {
        console.error("vrm.expressionManager is null");
        return;
      }
      const blinkExpressionTrackName = vrm.expressionManager.getExpressionTrackName('blink');
      if (!blinkExpressionTrackName) {
        console.error("Expression track name for 'blink' is null");
        return;
      }
      const blinkTrack = new THREE.NumberKeyframeTrack(
        blinkExpressionTrackName, // name
        [0.0, 0.05, 0.1, blinkInterval], // times
        [0.0, 1.0, 0.0, 0] // values
      );
      clip = new THREE.AnimationClip('Animation', 0.1 + blinkInterval, [blinkTrack]);
      blinkAnimationRef.current = mixerRef.current?.clipAction(clip)
      blinkAnimationRef.current?.play();

      const animate = () => {
        const deltaTime = clockRef.current?.getDelta();
        if (deltaTime) {
          mixerRef.current?.update(deltaTime);
          vrm.update(deltaTime);
        }
        controls.update();
        renderer.render(scene, camera);
      };
      renderer.setAnimationLoop(animate);

    };
    const handleResize = () => {
      updateBackground();
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // setup listener for click events
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      // detect if mouse click is on canvas
      const validElements = document.querySelectorAll('#character-canvas');
      const validElementsArray = Array.from(validElements);
      const targetElement = event.target as Element;
      // console.log(targetElement)
      if (targetElement && !validElementsArray.includes(targetElement)) return

      if (!canClickRef.current || lastPlayedGestureRef.current?.isRunning()) return;
      // Calculate mouse position in normalized device coordinates
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Update the raycaster with the camera and mouse position
      raycaster.setFromCamera(mouse, camera);

      if (!vrmRef.current) return
      // Check for intersections
      const intersects = raycaster.intersectObject(vrmRef.current.scene, true);

      if (intersects.length > 0) {
        handleBodyPartClick(intersects[0].object);
      }
    };

    window.addEventListener('click', onMouseClick, false);

    const handleBodyPartClick = (object: THREE.Object3D) => {
      console.log(object)
        
    //   loadAndPlayAnimation({ filename: animation, animationType: AnimationType.Gesture })
    }


    initVRMScene();
    return () => {
      mountNode?.removeChild(renderer.domElement);
      console.log("removing child")
      window.removeEventListener('click', onMouseClick, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  enum AnimationType {
    Idle, // idle animations are looped and resumes playing after a gesture animation is finished
    Gesture // gesture animations only plays once
  }

  type LoadAndPlayAnimationParams = {
    filename: string;
    animationType: AnimationType;
    fadeDuration?: number;
    override?: boolean; // if should override the current animation
    overridable?: boolean; // if playing an overridable gesture
    soundFile?: string;
  };

  const loadAndPlayAnimation = async ({
    filename,
    animationType,
    fadeDuration = 0.5,
    override = false,
    overridable = false,
  }: LoadAndPlayAnimationParams) => {
    // check if is overriding a gesture
    if ((!override && lastPlayedGestureRef.current && lastPlayedGestureRef.current.isRunning())) return;

    console.log("playing animation " + filename)
    // setLastInteractionTime(Date.now());
    const fullPath = filename
    if (!mixerRef.current) {
      return
    }
    if (!vrmRef.current) {
      return
    }

    const gltfVrma = await gltfLoaderRef.current.loadAsync(fullPath);
    const vrmAnimation = gltfVrma.userData.vrmAnimations[0];
    const clip = createVRMAnimationClip(vrmAnimation, vrmRef.current);

    // Create a new action for the new animation clip
    const newAction = mixerRef.current?.clipAction(clip);
    newAction.clampWhenFinished = true;

    // to transition from gesture back to idle
    const onAnimationFinish = () => {
      mixerRef.current?.removeEventListener('finished', onAnimationFinish); // Clean up the listener
      if (idleAnimationFileNameRef.current) {
        loadAndPlayAnimation({ filename: idleAnimationFileNameRef.current, animationType: AnimationType.Idle }); // resume idle animation
      }
    };

    // set up animation based on type
    if (animationType == AnimationType.Idle) {
      idleAnimationFileNameRef.current = filename;
      newAction.loop = THREE.LoopRepeat;
    } else if (animationType == AnimationType.Gesture) {
      // stop previous animation sound
      if (!overridable) { lastPlayedGestureRef.current = newAction; }
      newAction.loop = THREE.LoopOnce;
      mixerRef.current?.addEventListener('finished', onAnimationFinish);
    }

    // If there's a currently active action, fade it out
    if (mainAnimationRef.current) {
      newAction.weight = 1;
      // Start playing the new action first
      newAction.play();
      // Use crossFadeTo to transition from the current action to the new action
      mainAnimationRef.current.crossFadeTo(newAction, fadeDuration, true);
    } else {
      newAction.play();
    }
    mainAnimationRef.current = newAction;

  };

  return <div ref={mountRef} />;
};

export default VRM3dCanvas;