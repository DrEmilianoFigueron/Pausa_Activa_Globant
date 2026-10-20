import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Wind,
  ArrowLeftRight,
  Monitor,
  ChevronRight,
  ChevronLeft,
  Activity,
  Award,
  Eye,
  Droplets,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { activeBreakRoutines, Hotspot, TransitionStep, Routine } from "./data";

const getStepSideStatus = (routId: string, stepIdx: number, mirrored: boolean): string => {
  if (routId === 'cervical') {
    if (stepIdx === 0) return 'estándar';
    if (stepIdx === 1) return 'izquierdo';
    if (stepIdx === 2) return 'derecho';
  }
  if (routId === 'rotacion') {
    if (stepIdx === 0) return 'estándar';
    if (stepIdx === 1 || stepIdx === 3 || stepIdx === 5) return 'izquierdo';
    if (stepIdx === 2 || stepIdx === 4 || stepIdx === 6) return 'derecho';
  }
  if (routId === 'toracica') return 'estándar';
  if (routId === 'respiracion') return 'estándar';
  if (routId === 'triceps' || routId === 'elongacion_triceps') {
    if (stepIdx === 0) return 'estándar';
    if (stepIdx === 1) return 'derecho';
    if (stepIdx === 2) return 'izquierdo';
  }
  if (routId === 'muneca_codo') {
    if (stepIdx === 0) return 'estándar';
    if (stepIdx === 1 || stepIdx === 3) return 'derecho';
    if (stepIdx === 2 || stepIdx === 4) return 'izquierdo';
  }
  if (routId === 'rotacion_tronco') {
    if (stepIdx === 0) return 'estándar';
    if (stepIdx === 1) return 'derecho';
    if (stepIdx === 2) return 'izquierdo';
  }
  if (routId === 'piriforme') {
    if (stepIdx === 0) return 'estándar';
    if (stepIdx === 1) return 'derecho';
    if (stepIdx === 2) return 'izquierdo';
  }
  if (routId === 'bajando_tierra') return 'estándar';

  return mirrored ? 'izquierdo' : 'derecho';
};

const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '');


export default function App() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false); // Start paused — user must press Reanudar Ciclo
  const [routineIndex, setRoutineIndex] = useState<number>(0);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [prevStep, setPrevStep] = useState<number>(0);
  const [phase, setPhase] = useState<'hold' | 'transition'>('hold');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const routine = activeBreakRoutines[0];
    const step = routine.steps[0];
    const num = parseInt(step.duration);
    const base = isNaN(num) ? 15 : num;
    return routine.id === 'respiracion' ? base + 1 : base;
  });
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [isMirrored, setIsMirrored] = useState<boolean>(false);

  // Dual screen mode: 'body' = pausas activas (cuerpo), 'eyes' = fatiga visual 20/20/20
  const [screenMode, setScreenMode] = useState<'body' | 'eyes'>('body');
  // Marks the full body circuit as finished → shows the hydration closing screen
  const [sequenceFinished, setSequenceFinished] = useState<boolean>(false);

  // Eye-fatigue (20/20/20) sub-state machine
  // eyeStep: 0 = preparación (sin tiempo), 1 = enfoque distante (20s), 2 = lubricación (5s), 3 = fin
  const [eyeStep, setEyeStep] = useState<number>(0);
  const [eyeSeconds, setEyeSeconds] = useState<number>(0);
  const [eyeRunning, setEyeRunning] = useState<boolean>(false);

  // Reference for the background tick interval
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Continuous progress ring (0-100), driven by real elapsed time so it animates
  // smoothly from empty (start) to full (end) regardless of the integer countdown.
  const [ringProgress, setRingProgress] = useState<number>(0);
  const phaseElapsedRef = useRef<number>(0); // ms elapsed within the current phase

  // Reference for persistent video element (respiracion and future video routines)
  const videoRef = useRef<HTMLVideoElement>(null);

  // Gong que marca el fin de cada ejercicio
  const gongRef = useRef<HTMLAudioElement | null>(null);
  // Marcas puestas por los temporizadores al completarse un ejercicio. Son refs y no
  // estado porque los updaters de setSecondsRemaining/setEyeSeconds se invocan dos
  // veces bajo StrictMode: asignar true es idempotente, reproducir el audio no lo sería.
  const exerciseDoneRef = useRef<boolean>(false);
  const eyeDoneRef = useRef<boolean>(false);

  useEffect(() => {
    const gong = new Audio(asset('/audio/gong.mp3'));
    gong.preload = 'auto';
    gong.volume = 0.5;
    gongRef.current = gong;
  }, []);

  const playGong = () => {
    const gong = gongRef.current;
    if (!gong) return;
    gong.currentTime = 0;
    // El navegador puede rechazar la reproducción; nunca debe cortar el circuito
    gong.play().catch(() => {});
  };

  // Suena al terminar cada ejercicio: al pasar al siguiente y al cerrar el circuito.
  // Depende de la marca del temporizador, así que navegar manualmente no lo dispara.
  useEffect(() => {
    if (!exerciseDoneRef.current) return;
    exerciseDoneRef.current = false;
    playGong();
  }, [routineIndex, sequenceFinished]);

  // Suena al completarse los 20 segundos de fatiga visual
  useEffect(() => {
    if (!eyeDoneRef.current) return;
    eyeDoneRef.current = false;
    playGong();
  }, [eyeStep]);

  // Sync video playback with timer state and routine changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.currentTime = 0;
      video.play();
    } else {
      video.pause();
    }
  }, [isPlaying, routineIndex]);

  // Paleta Globant
  // Marca: negro #111111 · verde lima #BFD732 (acento, flecha del logo)
  // Texto: charcoal #333333 / gris #5C5C5C
  const uiBgPage    = 'bg-warm-canvas';
  const uiTextPage  = 'text-[#333333]';
  const uiBgCard    = 'bg-white';
  const uiBgPanel   = 'bg-[#F4F4F5]/50';
  const uiBorder    = 'border-[#E4E4E7]';
  const uiBorderCard= 'border-[#E4E4E7]';
  // Seleccionado: tinte verde lima + texto negro + anillo verde
  const uiBgActive  = 'bg-[#BFD732]/20 ring-1 ring-[#BFD732]/50';
  const uiTextActive = 'text-[#111111]';
  const uiBgInactive= 'bg-white/80 hover:bg-white';
  const uiTextPrimary   = 'text-[#333333]';
  const uiTextSecondary = 'text-[#5C5C5C]';
  const uiTextMuted     = 'text-[#8a8a8a]';
  const uiBgFooter  = 'bg-[#F4F4F5]';
  const uiBorderFooter = 'border-[#E4E4E7]';
  const uiBgActionBlock= 'bg-[#FAFAFA] border-[#111111]';
  const uiTextAccent    = 'text-[#111111]';
  const uiBgRingTrack   = '#E4E4E7';

  const currentRoutine = activeBreakRoutines[routineIndex];
  const currentStepData = currentRoutine.steps[activeStep];
  const TRANSITION_DURATION = 3.0; // 3 seconds transition for all exercises

  const isImageMirrored = (() => {
    if (currentRoutine.id === 'cervical') {
      if (activeStep === 1) return false; // Right cervical stretch (not mirrored)
      if (activeStep === 2) return true;  // Left cervical stretch (mirrored)
      return isMirrored;
    }
    if (currentRoutine.id === 'rotacion') {
      if (activeStep === 1 || activeStep === 3 || activeStep === 5) return false; // Left (real image, no mirror)
      if (activeStep === 2 || activeStep === 4 || activeStep === 6) return false; // Right (not mirrored)
      return isMirrored;
    }
    return isMirrored;
  })();

  // Dynamic helper to parse seconds from string duration (e.g., "12 segundos" -> 12)
  const getStepHoldDuration = (stepIdx: number, routIdx: number) => {
    const routine = activeBreakRoutines[routIdx];
    const step = routine.steps[stepIdx];
    if (!step) return 15;
    const num = parseInt(step.duration);
    const base = isNaN(num) ? 15 : num;
    return routine.id === 'respiracion' ? base + 1 : base;
  };

  // Helper to change routines cleanly — always pauses and resets to step 1
  const handleSetRoutineIndex = (newIndex: number) => {
    setIsPlaying(false);
    setRoutineIndex(newIndex);
    setActiveStep(0);
    setPrevStep(0);
    setPhase('hold');
    phaseElapsedRef.current = 0;
    setRingProgress(0);
    const firstStepDuration = getStepHoldDuration(0, newIndex);
    setSecondsRemaining(firstStepDuration);
    setSliderValue(0);
  };

  const handlePrevRoutine = () => {
    const newIdx = (routineIndex - 1 + activeBreakRoutines.length) % activeBreakRoutines.length;
    handleSetRoutineIndex(newIdx);
  };

  const handleNextRoutine = () => {
    const newIdx = (routineIndex + 1) % activeBreakRoutines.length;
    handleSetRoutineIndex(newIdx);
  };

  // Restart the whole body circuit from zero (used by the closing/hydration screen)
  const restartCircuit = () => {
    setSequenceFinished(false);
    setRoutineIndex(0);
    setActiveStep(0);
    setPrevStep(0);
    setPhase('hold');
    setIsMirrored(false);
    setSliderValue(0);
    phaseElapsedRef.current = 0;
    setRingProgress(0);
    setSecondsRemaining(getStepHoldDuration(0, 0));
    setIsPlaying(false);
  };

  // Restart only the current phase timer (countdown + progress ring)
  const restartPhaseTimer = () => {
    phaseElapsedRef.current = 0;
    setRingProgress(0);
    setSecondsRemaining(phase === 'hold'
      ? getStepHoldDuration(activeStep, routineIndex)
      : Math.floor(TRANSITION_DURATION));
  };

  // Switch between body and eye-fatigue modes
  const goBodyMode = () => {
    setScreenMode('body');
    setEyeRunning(false);
  };
  const goEyesMode = () => {
    setScreenMode('eyes');
    setIsPlaying(false); // pause the body timer while in eye mode
    setEyeStep(0);
    setEyeSeconds(0);
    setEyeRunning(false);
  };

  // Eye exercise controls
  const startEyeExercise = () => {
    setEyeStep(1);     // jump from preparación straight to enfoque distante
    setEyeSeconds(20); // 20 segundos (regla 20/20/20)
    setEyeRunning(true);
  };
  const resetEyeExercise = () => {
    setEyeStep(0);
    setEyeSeconds(0);
    setEyeRunning(false);
  };

  // State Machine logic representing steps and routine rotations
  useEffect(() => {
    if (!isPlaying) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setSecondsRemaining(prevSec => {
        // Circuito ya cerrado: sin esta guarda un tick tardío volvería a entrar en la
        // rama de fin y dejaría el gong marcado, sonando en el próximo ejercicio.
        if (prevSec <= 0) return 0;
        if (prevSec <= 1) {
          // Transition when timer hits zero!
          if (phase === 'hold') {
            // Finished holding, check if it was the last step
            if (activeStep === currentRoutine.steps.length - 1) {
              // Last step of an exercise — is it also the last exercise of the sequence?
              if (routineIndex === activeBreakRoutines.length - 1) {
                // Whole circuit finished → stop and show the closing/hydration screen
                exerciseDoneRef.current = true;
                setSequenceFinished(true);
                setIsPlaying(false);
                return 0;
              }
              // Otherwise advance to the next exercise (no wrap-around looping)
              const nextRoutineIdx = routineIndex + 1;
              exerciseDoneRef.current = true;
              setRoutineIndex(nextRoutineIdx);
              // prevStep and sliderValue must be 0 (not the old routine's last step): the
              // slider would otherwise show/sweep the NEW routine's image stack during
              // the transition (sliderValue is set in this same batch to avoid a one-frame
              // flash of the wrong image before the slider effect runs)
              setPrevStep(0);
              setSliderValue(0);
              setActiveStep(0);
              setPhase('transition');
              return Math.floor(TRANSITION_DURATION);
            } else {
              // Finished holding, move towards next step
              const nextStepIndex = (activeStep + 1) % currentRoutine.steps.length;
              setPrevStep(activeStep);
              setActiveStep(nextStepIndex);
              // Video routines: skip transition, flow directly to next hold
              if (currentRoutine.steps[0]?.image.startsWith('video:')) {
                setPhase('hold');
                return getStepHoldDuration(nextStepIndex, routineIndex);
              }
              setPhase('transition');
              return Math.floor(TRANSITION_DURATION);
            }
          } else {
            // Finished transition, hold current step
            setPhase('hold');
            
            // If just transitioned back to step 0, auto-alternate the mirrored side so employees stretch BOTH sides!
            if (activeStep === 0) {
              setIsMirrored(prev => !prev);
            }

            return getStepHoldDuration(activeStep, routineIndex);
          }
        }
        return prevSec - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isPlaying, phase, activeStep, isMirrored, routineIndex, currentRoutine]);

  // Eye-fatigue (20/20/20) timer. Step 0 has no countdown (manual start). Step 1 is the
  // single 20-second distant-focus countdown; on reaching zero it goes to step 3 (fin, stop).
  useEffect(() => {
    if (screenMode !== 'eyes' || !eyeRunning) return;
    const id = setInterval(() => {
      setEyeSeconds(prev => {
        // Ya finalizado: el intervalo puede tickear de nuevo antes de que el efecto
        // lo limpie, y sin esta guarda volvería a marcar el gong con prev = 0.
        if (prev <= 0) return 0;
        if (prev > 1) return prev - 1;
        // 20-second focus finished → done (no lubrication phase)
        if (eyeStep === 1) {
          eyeDoneRef.current = true;
          setEyeStep(3);
          setEyeRunning(false);
          return 0; // ejercicio ocular finalizado (sin pantalla posterior)
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [screenMode, eyeRunning, eyeStep]);

  // Reset the ring whenever a new phase/step/routine begins (NOT on pause).
  useEffect(() => {
    phaseElapsedRef.current = 0;
    setRingProgress(0);
  }, [phase, activeStep, routineIndex]);

  // Drive the ring continuously from real elapsed time. Uses setInterval (not rAF) so it
  // keeps advancing even if the tab is backgrounded. Freezes (keeps accumulated elapsed)
  // when paused and resumes from where it left off.
  useEffect(() => {
    if (!isPlaying) return;
    const totalMs = (phase === 'hold' ? getStepHoldDuration(activeStep, routineIndex) : TRANSITION_DURATION) * 1000;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      phaseElapsedRef.current += now - last;
      last = now;
      setRingProgress(Math.min(phaseElapsedRef.current / totalMs, 1) * 100);
    }, 50);
    return () => clearInterval(id);
  }, [isPlaying, phase, activeStep, routineIndex]);

  // Smooth frame interpolation logic using custom requestAnimationFrame
  useEffect(() => {
    if (phase === 'hold') {
      // Lock slider exactly to the target step when holding
      setSliderValue(activeStep);
      return;
    }

    // When transitioning, interpolate based on elapsed secondsRemaining
    let animId: number;
    const startValue = prevStep;
    
    // Normalize target step value to slide wrapping cleanly from last step to 0
    let targetValue = activeStep;
    const totalSteps = currentRoutine.steps.length;
    if (startValue === totalSteps - 1 && targetValue === 0) {
      // Loop wrapping effect helper
      targetValue = totalSteps; // interpolate forward, then wrap back after transition holds
    }

    const durationMs = TRANSITION_DURATION * 1000;
    const startTime = performance.now();

    const animateSlider = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      // Smooth step easing curve
      const easeInOutQuad = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      let val = startValue + (targetValue - startValue) * easeInOutQuad;
      if (val >= totalSteps) val = val - totalSteps; // wrap back safely
      
      setSliderValue(val);

      if (progress < 1) {
        animId = requestAnimationFrame(animateSlider);
      } else {
        setSliderValue(activeStep);
      }
    };

    animId = requestAnimationFrame(animateSlider);
    return () => cancelAnimationFrame(animId);
  }, [phase, activeStep, prevStep, currentRoutine, routineIndex]);

  // Dedicated component to render either legacy images or high-fidelity beautiful SVGs which are fully responsive
  function Illustration({ imageKey, isMirrored }: { imageKey: string; isMirrored: boolean }) {
    if (imageKey.startsWith('video:')) {
      const src = asset(imageKey.substring(6));
      return (
        <video
          src={src}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover select-none"
          style={{ pointerEvents: 'none' }}
        />
      );
    }

    if (!imageKey.startsWith('svg:')) {
      return (
        <img
          src={asset(imageKey)}
          alt="Pose de estiramiento"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover select-none"
          style={{ pointerEvents: 'none' }}
        />
      );
    }

    const type = imageKey.substring(4); // e.g., "wrist_warmup"

    return (
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#FAFAFA] to-[#F4F4F5] flex flex-col items-center justify-center p-6 select-none">
        <svg
          className="w-full h-[75%] grow text-[#111111]"
          viewBox="0 0 200 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Target focus backdrop circle */}
          <circle cx="100" cy="120" r="75" stroke="#111111" strokeWidth="1" strokeDasharray="3 4" opacity="0.12" />

          {/* Postural chair reference anchor */}
          <path d="M60 210 L140 210 M100 210 L100 170 M70 170 L130 170 M80 170 L85 110 M120 170 L115 110" stroke="#E4E4E7" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
          
          {/* Base body silhouette */}
          <path d="M80 150 C80 120, 120 120, 120 150 L125 185 L75 185 Z" fill="#F4F4F5" stroke="#E4E4E7" strokeWidth="1.5" />

          {/* SVG Poses Switch Board */}
          {type === "wrist_warmup" && (
            <g>
              <circle cx="100" cy="98" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              {/* Circulation ripples */}
              <circle cx="100" cy="142" r="26" stroke="#BFD732" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" className="animate-ping" style={{ transformOrigin: '100px 142px' }} />
              <circle cx="100" cy="142" r="16" stroke="#111111" strokeWidth="1.5" opacity="0.7" />
              {/* Joined hands */}
              <g className="animate-bounce" style={{ transformOrigin: '100px 142px', animationDuration: '2s' }}>
                <path d="M92 145 C92 135, 96 124, 100 124 C104 124, 108 135, 108 145 Z" fill="#BFD732" opacity="0.85" />
                <path d="M96 148 C96 142, 98 131, 100 131 C102 131, 104 142, 104 148 Z" fill="#111111" />
                <line x1="82" y1="135" x2="88" y2="138" stroke="#BFD732" strokeWidth="2" strokeLinecap="round" />
                <line x1="118" y1="135" x2="112" y2="138" stroke="#BFD732" strokeWidth="2" strokeLinecap="round" />
              </g>
            </g>
          )}

          {type === "wrist_extension" && (
            <g>
              <circle cx="100" cy="85" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              {/* Shoulder & arm */}
              <path d="M75 130 H120" stroke="#111111" strokeWidth="12" strokeLinecap="round" />
              {/* Hand extended up */}
              <path d="M120 130 V102" stroke="#BFD732" strokeWidth="10" strokeLinecap="round" />
              {/* Support hand guiding */}
              <path d="M130 112 Q126 102, 118 102" stroke="#111111" strokeWidth="6" strokeLinecap="round" />
              {/* Flow arrows */}
              <path d="M136 102 L116 102 M122 97 L116 102 L122 107" stroke="#BFD732" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" />
            </g>
          )}

          {type === "wrist_flexion" && (
            <g>
              <circle cx="100" cy="85" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              {/* Arm */}
              <path d="M75 130 H120" stroke="#111111" strokeWidth="12" strokeLinecap="round" />
              {/* Hand flexed down */}
              <path d="M120 130 V158" stroke="#BFD732" strokeWidth="10" strokeLinecap="round" />
              {/* Other hand pushing */}
              <path d="M130 148 Q126 158, 118 158" stroke="#111111" strokeWidth="6" strokeLinecap="round" />
              {/* Action arrows */}
              <path d="M136 158 L116 158 M122 153 L116 158 L122 163" stroke="#BFD732" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" />
            </g>
          )}

          {type === "wrist_rotation" && (
            <g>
              <circle cx="100" cy="90" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              <g className="animate-spin" style={{ transformOrigin: '100px 142px', animationDuration: '5s' }}>
                <circle cx="100" cy="142" r="24" stroke="#111111" strokeWidth="2" strokeDasharray="5 4" opacity="0.6" />
                <path d="M85 142 C85 128, 115 128, 115 142 S85 156, 85 142" fill="#111111" stroke="#BFD732" strokeWidth="2.5" />
              </g>
              <path d="M132 142 A 32 32 0 0 1 68 142" stroke="#BFD732" strokeWidth="1.5" strokeDasharray="3 3" />
            </g>
          )}

          {type === "shoulder_chest_open" && (
            <g>
              <circle cx="100" cy="80" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              {/* Expanded posture */}
              <path d="M100 108 C80 108, 65 115, 60 128 L68 180 L132 180 L140 128 C135 115, 120 108, 100 108 Z" fill="#FAFAFA" stroke="#111111" strokeWidth="2" />
              {/* Locked hands behind */}
              <path d="M86 162 L100 184 L114 162 Z" fill="#111111" stroke="#BFD732" strokeWidth="2" />
              {/* Open vector pulses */}
              <path d="M54 118 Q40 132, 54 146" stroke="#BFD732" strokeWidth="3" strokeLinecap="round" className="animate-pulse" />
              <path d="M146 118 Q160 132, 146 146" stroke="#BFD732" strokeWidth="3" strokeLinecap="round" className="animate-pulse" />
            </g>
          )}

          {type === "shoulder_crossover" && (
            <g>
              <circle cx="100" cy="80" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              <path d="M100 108 C80 108, 65 115, 60 128 L68 180 L132 180 L140 128 C135 115, 120 108, 100 108 Z" fill="#F4F4F5" />
              {/* Transversal crossover arm */}
              <path d="M62 130 H128" stroke="#111111" strokeWidth="12" strokeLinecap="round" />
              {/* Locking vertical arm */}
              <path d="M112 114 V146" stroke="#BFD732" strokeWidth="12" strokeLinecap="round" />
              {/* Pulling force indicators */}
              <path d="M124 130 H138 M132 125 L138 130 L132 135" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}

          {type === "shoulder_shrug" && (
            <g>
              <circle cx="100" cy="80" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              {/* Moving shoulders back & down circle */}
              <g className="animate-spin" style={{ transformOrigin: '72px 122px', animationDuration: '4.5s' }}>
                <circle cx="72" cy="122" r="10" stroke="#BFD732" strokeWidth="2" strokeDasharray="3 3" />
                <circle cx="80" cy="122" r="3.5" fill="#111111" />
              </g>
              <g className="animate-spin" style={{ transformOrigin: '128px 122px', animationDuration: '4.5s' }}>
                <circle cx="128" cy="122" r="10" stroke="#BFD732" strokeWidth="2" strokeDasharray="3 3" />
                <circle cx="120" cy="122" r="3.5" fill="#111111" />
              </g>
              {/* Shoulder frame */}
              <path d="M66 130 C72 120, 128 120, 134 130" stroke="#111111" strokeWidth="4" strokeLinecap="round" />
            </g>
          )}

          {type === "thoracic_start" && (
            <g>
              {/* Head */}
              <circle cx="100" cy="78" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              {/* Torso erguido */}
              <path d="M100 96 C80 96, 65 108, 62 128 L68 178 L132 178 L138 128 C135 108, 120 96, 100 96 Z" fill="#FAFAFA" stroke="#7c5c3e" strokeWidth="2" />
              {/* Manos sobre muslos */}
              <path d="M74 155 L68 178" stroke="#7c5c3e" strokeWidth="8" strokeLinecap="round" />
              <path d="M126 155 L132 178" stroke="#7c5c3e" strokeWidth="8" strokeLinecap="round" />
              <ellipse cx="68" cy="182" rx="10" ry="5" fill="#7c5c3e" opacity="0.7" />
              <ellipse cx="132" cy="182" rx="10" ry="5" fill="#7c5c3e" opacity="0.7" />
              {/* Pies */}
              <ellipse cx="78" cy="215" rx="12" ry="5" fill="#E4E4E7" />
              <ellipse cx="122" cy="215" rx="12" ry="5" fill="#E4E4E7" />
              {/* Pulse indicador postura */}
              <path d="M100 60 V48 M95 54 L100 48 L105 54" stroke="#7c5c3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce" />
            </g>
          )}

          {type === "thoracic_ready" && (
            <g>
              {/* Head */}
              <circle cx="100" cy="78" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              {/* Torso */}
              <path d="M100 96 C80 96, 65 108, 62 128 L68 178 L132 178 L138 128 C135 108, 120 96, 100 96 Z" fill="#FAFAFA" stroke="#7c5c3e" strokeWidth="2" />
              {/* Brazos con codos al frente */}
              <path d="M72 118 L60 108 L76 98" stroke="#7c5c3e" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M128 118 L140 108 L124 98" stroke="#7c5c3e" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
              {/* Manos entrelazadas en nuca */}
              <path d="M76 94 Q100 86 124 94" stroke="#7c5c3e" strokeWidth="6" strokeLinecap="round" />
              {/* Codos convergentes indicador */}
              <path d="M62 108 Q100 120 138 108" stroke="#7c5c3e" strokeWidth="2" strokeDasharray="4 3" opacity="0.5" />
              <circle cx="60" cy="108" r="5" fill="#7c5c3e" opacity="0.8" className="animate-pulse" />
              <circle cx="140" cy="108" r="5" fill="#7c5c3e" opacity="0.8" className="animate-pulse" />
            </g>
          )}

          {type === "thoracic_open" && (
            <g>
              {/* Head */}
              <circle cx="100" cy="78" r="18" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              {/* Torso expandido */}
              <path d="M100 96 C78 96, 60 108, 56 128 L64 178 L136 178 L144 128 C140 108, 122 96, 100 96 Z" fill="#FAFAFA" stroke="#7c5c3e" strokeWidth="2.5" />
              {/* Brazos abiertos hacia atrás */}
              <path d="M66 118 L44 105 L62 92" stroke="#7c5c3e" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M134 118 L156 105 L138 92" stroke="#7c5c3e" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
              {/* Manos en nuca */}
              <path d="M62 88 Q100 78 138 88" stroke="#7c5c3e" strokeWidth="6" strokeLinecap="round" />
              {/* Flechas de apertura */}
              <path d="M48 105 L32 105 M38 100 L32 105 L38 110" stroke="#BFD732" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" />
              <path d="M152 105 L168 105 M162 100 L168 105 L162 110" stroke="#BFD732" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" />
              {/* Escápulas aproximadas indicator */}
              <path d="M82 130 Q100 138 118 130" stroke="#7c5c3e" strokeWidth="2" strokeDasharray="3 3" opacity="0.6" className="animate-pulse" />
            </g>
          )}

          {type === "shoulder_overhead" && (
            <g>
              <circle cx="100" cy="94" r="16" fill="#EAEAEC" stroke="#A1A1AA" strokeWidth="2" />
              {/* Reaching vertical overhead */}
              <path d="M72 165 L72 132 L84 66" stroke="#111111" strokeWidth="11" strokeLinecap="round" />
              <path d="M128 165 L128 132 L116 66" stroke="#111111" strokeWidth="11" strokeLinecap="round" />
              <path d="M84 62 H116" stroke="#BFD732" strokeWidth="12" strokeLinecap="round" />
              {/* Traction dynamic arrow */}
              <path d="M100 48 V34 M95 40 L100 34 L105 40" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce" />
            </g>
          )}
        </svg>

        {/* Brand label */}
        <span className="text-[10px] font-mono font-bold tracking-widest text-[#111111] uppercase bg-[#111111]/10 px-3.5 py-1.5 rounded-full mt-auto">
          Biomecánica Globant
        </span>
      </div>
    );
  }

  return (
    <div id="active-break-root" className={`min-h-screen ${uiBgPage} ${uiTextPage} font-sans flex flex-col justify-between selection:bg-[#111111]/20 overflow-x-hidden transition-colors duration-300`}>

      {/* HEADER */}
      <header className={`w-full bg-white border-b border-[#E4E4E7] px-8 py-5 flex items-center shadow-sm z-50 relative`}>
        <img
          src={asset('/images/logo_globant.svg')}
          alt="Globant"
          className={`h-8 object-contain`}
        />
        <span className={`ml-5 pl-5 border-l border-[#E4E4E7] text-[#111111] font-display font-semibold text-lg tracking-tight`}>
          Pausas Activas
        </span>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-8 flex flex-col justify-center items-center relative">

        {/* DUAL MODE SELECTOR — Cuerpo vs Fatiga Visual */}
        <div id="mode-selector" className="w-full max-w-3xl mb-6">
          <div className={`flex items-center gap-2 ${uiBgPanel} p-2 rounded-[20px] border ${uiBorder}`}>
            <button
              onClick={goBodyMode}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                screenMode === 'body'
                  ? `${uiBgActive} ${uiTextActive} shadow-sm`
                  : `${uiTextMuted} hover:bg-white/60`
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Pausas Activas</span>
            </button>
            <button
              onClick={goEyesMode}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                screenMode === 'eyes'
                  ? `${uiBgActive} ${uiTextActive} shadow-sm`
                  : `${uiTextMuted} hover:bg-white/60`
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Fatiga Visual</span>
            </button>
          </div>
        </div>

        {/* ============ EYE-FATIGUE MODE PANEL ============ */}
        {screenMode === 'eyes' && (
          <div id="eye-panel" className="w-full max-w-3xl flex flex-col items-center">
            {/* Header: acción a realizar */}
            <div className={`w-full bg-[#FAFAFA] border-[#111111] border-l-4 p-6 rounded-r-[24px] shadow-xs mb-6`}>
              <h4 className="text-xs uppercase font-extrabold tracking-widest text-[#111111] mb-2">¿Qué debe hacer ahora?</h4>
              <p className={`text-xl font-bold ${uiTextPrimary} leading-relaxed`}>
                Desvía la mirada de la pantalla e identifica un punto u objeto lejano en la oficina (ejemplo: un cuadro, una ventana o planta).
              </p>
            </div>

            <div className={`w-full ${uiBgCard} rounded-[32px] border ${uiBorder} shadow-sm p-6 sm:p-10 flex flex-col items-center`}>

              {/* ===== BIG HIGH-CONTRAST TIMER (visible al apartar la mirada) ===== */}
              {(() => {
                const total = 20;
                const displayNum = eyeStep === 0 ? 20 : eyeSeconds;
                const progress = eyeStep === 0 ? 0 : (total - eyeSeconds) / total;
                const R = 130;
                const C = 2 * Math.PI * R;
                return (
                  <div className="relative w-[300px] h-[300px] sm:w-[340px] sm:h-[340px] flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 300 300">
                      <circle cx="150" cy="150" r={R} stroke={'#F4F4F5'} strokeWidth="20" fill="transparent" />
                      <circle
                        cx="150" cy="150" r={R}
                        stroke="#BFD732" strokeWidth="20" fill="transparent" strokeLinecap="round"
                        strokeDasharray={C}
                        strokeDashoffset={C * (1 - progress)}
                        style={{ transition: 'stroke-dashoffset 1000ms linear' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-[7rem] sm:text-[8rem] font-display font-extrabold text-[#141414] font-mono leading-none tabular-nums`}>
                        {displayNum}
                      </span>
                      <span className={`text-sm font-bold text-[#5C5C5C] uppercase tracking-[0.3em] mt-1`}>Segundos</span>
                    </div>
                  </div>
                );
              })()}

              {/* PLAY / CONTROL BUTTON (debajo del timer) */}
              <div className="mt-7 flex flex-col items-center gap-3">
                {eyeStep === 0 && (
                  <button
                    onClick={startEyeExercise}
                    className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold uppercase tracking-wider bg-[#111111] hover:bg-[#000000] text-white shadow-lg transition-all duration-300"
                  >
                    <Play className="w-5 h-5 fill-white text-white" />
                    Iniciar 20/20/20
                  </button>
                )}
                {eyeStep === 1 && (
                  <button
                    onClick={resetEyeExercise}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 text-[#5C5C5C] hover:bg-[#F4F4F5]`}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reiniciar
                  </button>
                )}
                {eyeStep === 3 && (
                  <button
                    onClick={resetEyeExercise}
                    className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold uppercase tracking-wider bg-[#111111] hover:bg-[#000000] text-white shadow-lg transition-all duration-300"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Repetir ejercicio
                  </button>
                )}

                {/* Done message */}
                {eyeStep === 3 && (
                  <p className={`text-center text-base ${uiTextSecondary} max-w-md mt-1 leading-relaxed`}>
                    ¡Vista descansada! Repite este ejercicio cada 20 minutos frente a la pantalla.
                  </p>
                )}
              </div>

            </div>

            {/* ¿Por qué sirve? + recomendaciones ergonómicas */}
            <div className="w-full mt-8 space-y-6">
              <div className="px-2">
                <h4 className={`text-xs uppercase font-bold tracking-widest ${uiTextMuted} mb-2`}>¿Por qué sirve este ejercicio? (Regla médica 20/20/20)</h4>
                <p className={`text-base ${uiTextSecondary} font-light leading-relaxed`}>
                  Al trabajar frente a monitores, la mirada se enfoca permanentemente en un plano fijo y cercano. Esto fatiga constantemente el músculo ciliar de tu ojo. Estirar la mirada a 20 pies (mínimo 6 metros) por 20 segundos permite que el músculo ocular se relaje por completo, previniendo la miopía de acomodación y el enrojecimiento.
                </p>
              </div>

              <div className="px-2">
                <h4 className={`text-xs font-bold tracking-wider ${uiTextMuted} uppercase mb-3`}>Recomendaciones extra para la salud visual</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={`${uiBgCard} border border-[#EAEAEC] rounded-2xl p-4`}>
                    <h5 className={`text-[11px] font-bold uppercase tracking-wider ${uiTextAccent} mb-1.5`}>Brillo de monitor</h5>
                    <p className={`text-xs ${uiTextSecondary} leading-relaxed`}>Combina el brillo del monitor con la luminosidad del cuarto para evitar contrastes agresivos.</p>
                  </div>
                  <div className={`${uiBgCard} border border-[#EAEAEC] rounded-2xl p-4`}>
                    <h5 className={`text-[11px] font-bold uppercase tracking-wider ${uiTextAccent} mb-1.5`}>Distancia de trabajo</h5>
                    <p className={`text-xs ${uiTextSecondary} leading-relaxed`}>Coloca la pantalla a 50-60 cm de distancia de tu cara (el largo de tu brazo).</p>
                  </div>
                  <div className={`${uiBgCard} border border-[#EAEAEC] rounded-2xl p-4`}>
                    <h5 className={`text-[11px] font-bold uppercase tracking-wider ${uiTextAccent} mb-1.5`}>Lubricación natural</h5>
                    <p className={`text-xs ${uiTextSecondary} leading-relaxed`}>Ante pantallas parpadeamos un 70% menos. Haz pausas deliberadas para parpadear consciente.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ BODY CLOSING / HYDRATION SCREEN ============ */}
        {screenMode === 'body' && sequenceFinished && (
          <div id="closing-screen" className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

            {/* COLUMN 1: COMPLETION IMAGE FRAME (mirrors the posture frame) */}
            <div className="lg:col-span-12 xl:col-span-5 flex flex-col items-center justify-center">

              {/* Session badge (mirrors the Sector badge) */}
              <div className="mb-4 text-center">
                <span className="text-xs font-bold text-[#8a8a8a] tracking-wider uppercase">Sesión completada</span>
                <div className="mt-1 flex items-center justify-center">
                  <span className="bg-[#3e8e6b]/12 text-[#2f7a59] py-0.5 px-3 rounded-lg border border-[#3e8e6b]/25 font-mono text-sm uppercase">
                    Hidratación y movimiento
                  </span>
                </div>
              </div>

              {/* Poster Frame */}
              <div className="relative bg-white p-4.5 rounded-[36px] border border-[#E4E4E7] shadow-xl w-full max-w-[340px] sm:max-w-[360px] md:max-w-[380px] lg:max-w-[390px] overflow-hidden">
                {/* Completion badge */}
                <div className="absolute top-8 left-8 z-20 bg-[#2f7a59] text-white font-mono text-[10px] uppercase tracking-wider py-1.5 px-3.5 rounded-full font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Completo 100%
                </div>

                {/* Locked Aspect Box — imagen de hidratación (búsqueda de agua) */}
                <div className="relative aspect-[9/16] w-full rounded-[24px] overflow-hidden bg-[#F4F4F5]">
                  <img
                    src={asset('/images/busqueda_agua.webp')}
                    alt="Persona caminando a buscar agua"
                    className="absolute inset-0 w-full h-full object-cover select-none"
                    style={{ pointerEvents: 'none' }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />
                </div>
              </div>
            </div>

            {/* COLUMN 2: CLOSING MESSAGE */}
            <div className="lg:col-span-12 xl:col-span-7 flex flex-col justify-center space-y-6">

              <div className="space-y-2">
                <span className="text-xs font-extrabold tracking-widest text-[#2f7a59] uppercase block">
                  ¡Felicidades por cuidar tu cuerpo!
                </span>
                <h2 className={`font-display font-extrabold text-4xl sm:text-5xl ${uiTextPrimary} tracking-tight leading-tight`}>
                  Ciclo de Pausas Finalizado con Éxito
                </h2>
              </div>

              {/* Recommendation card */}
              <div className={`${uiBgCard} p-6 sm:p-8 rounded-[28px] border ${uiBorder} shadow-sm space-y-5`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#3e8e6b]/12 flex items-center justify-center shrink-0">
                    <Droplets className="w-5 h-5 text-[#2f7a59]" />
                  </div>
                  <div>
                    <h4 className={`font-display font-bold text-lg ${uiTextPrimary} leading-tight`}>Una recomendación más</h4>
                    <p className={`text-xs ${uiTextMuted}`}>Recomendación de Salud Ocupacional Globant</p>
                  </div>
                </div>

                <div className={`border-t border-[#F4F4F5] pt-5 space-y-3`}>
                  <p className={`text-lg font-bold ${uiTextPrimary} leading-relaxed`}>
                    ¡Fantástico trabajo cuidando tu salud! Has completado todas las secuencias de estiramiento.
                  </p>
                  <p className={`text-base ${uiTextSecondary} leading-relaxed`}>
                    Como última recomendación <span className={`font-bold ${uiTextAccent}`}>ahora desconéctate unos minutos de la pantalla, levántate de tu silla y camina un poco yendo a buscar agua para mantenerte hidratado.</span>
                  </p>
                  <p className={`text-sm ${uiTextMuted} font-light leading-relaxed`}>
                    Caminar de forma activa estira tus miembros inferiores, destraba tu columna lumbar después de estar sentado y reactiva de forma inmediata la circulación general de tu cuerpo.
                  </p>
                </div>
              </div>

              <button
                onClick={restartCircuit}
                className="self-start flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider bg-[#111111] hover:bg-[#000000] text-white shadow-md transition-all duration-300"
              >
                <RotateCcw className="w-4 h-4" />
                Volver a iniciar el circuito
              </button>
            </div>
          </div>
        )}

        {/* ============ BODY ACTIVE-BREAK CONTENT ============ */}
        {screenMode === 'body' && !sequenceFinished && (
        <>
        {/* ROUTINE/EXERCISE CAROUSEL BAR (Top indicators matching Spanish language rules) */}
        <div id="routine-tabs" className="w-full mb-8">
          <div className={`flex items-center gap-3 ${uiBgPanel} p-2.5 rounded-[24px] border ${uiBorder}`}>
            {/* Arrow only — previous */}
            <button
              onClick={handlePrevRoutine}
              className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${uiBgInactive} ${uiTextAccent} border ${uiBorderCard} shadow-sm hover:scale-105 transition-all duration-200`}
              title="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Bubbles in a concrete aligned grid */}
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {activeBreakRoutines.map((routine, rIdx) => {
                const isActive = rIdx === routineIndex;
                return (
                  <button
                    key={routine.id}
                    onClick={() => handleSetRoutineIndex(rIdx)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider leading-tight text-center transition-all duration-300 ${
                      isActive
                        ? `${uiBgActive} ${uiTextActive} shadow-sm`
                        : `${uiBgInactive} text-[#5C5C5C] border ${uiBorderCard}`
                    }`}
                  >
                    {routine.name}
                  </button>
                );
              })}
            </div>

            {/* Arrow only — next */}
            <button
              onClick={handleNextRoutine}
              className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${uiBgInactive} ${uiTextAccent} border ${uiBorderCard} shadow-sm hover:scale-105 transition-all duration-200`}
              title="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Board Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* COLUMN 1: VISUAL POSTURE FRAME (9:16 locked high-fidelity rendering) */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col items-center justify-center">
            
            {/* Mirror State notification pill */}
            <div className="mb-4 text-center">
              <span className="text-xs font-bold text-[#8a8a8a] tracking-wider uppercase">Sector</span>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xl font-display font-extrabold text-[#333333]">
                <span className={`bg-[#111111]/10 text-[#333333] border-[#111111]/20 py-0.5 px-3 rounded-lg border font-mono text-sm uppercase`}>
                  {currentRoutine.targetArea}
                </span>
                <span className={`text-xs py-1 px-2.5 rounded-md font-bold uppercase tracking-wider ${
                  getStepSideStatus(currentRoutine.id, activeStep, isMirrored) === 'izquierdo'
                    ? 'bg-[#BFD732]/15 text-[#BFD732]'
                    : getStepSideStatus(currentRoutine.id, activeStep, isMirrored) === 'derecho'
                    ? 'bg-[#BFD732]/15 text-[#BFD732]'
                    : 'bg-[#8a8a8a]/15 text-[#8a8a8a]'
                }`}>
                  {getStepSideStatus(currentRoutine.id, activeStep, isMirrored)}
                </span>
              </div>
            </div>

            {/* Poster Frame aspect-locked 9:16 */}
            <div id="posture-card-frame" className={`relative ${uiBgCard} p-4.5 rounded-[36px] border ${uiBorderCard} shadow-xl w-full max-w-[340px] sm:max-w-[360px] md:max-w-[380px] lg:max-w-[390px] overflow-hidden`}>
              
              {/* Sliding step progress badge */}
              <div className="absolute top-8 left-8 z-20 bg-black/75 backdrop-blur-md text-white font-mono text-[10px] uppercase tracking-wider py-1.5 px-3.5 rounded-full font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#BFD732] animate-pulse" />
                POSTURA {activeStep+1}/{currentRoutine.steps.length}
              </div>

              <div className="absolute top-8 right-8 z-20 flex gap-2">
                <div className="bg-[#111111] text-white text-[10px] uppercase font-bold tracking-widest py-1.5 px-3 rounded-full">
                  {phase === 'hold' ? "Sostener" : "Transición"}
                </div>
              </div>

              {/* Locked Aspect Box */}
              <div className={`relative aspect-[9/16] w-full rounded-[24px] overflow-hidden bg-[#F4F4F5]/40 shadow-inner transition-transform duration-500 ${
                isImageMirrored ? "scale-x-[-1]" : ""
              }`}>
                
                {/* Persistent video layer — keyed to routine so it never remounts on step change */}
                {currentRoutine.steps[0]?.image.startsWith('video:') && (
                  <video
                    key={currentRoutine.id}
                    ref={videoRef}
                    src={asset(currentRoutine.steps[0].image.substring(6))}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover select-none z-10"
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Dynamically Blended Images or Custom SVG Vectors */}
                {currentRoutine.steps.map((step, idx) => {
                  if (step.image.startsWith('video:')) return null;
                  const opacity = Math.max(0, 1 - Math.abs(sliderValue - idx));

                  return (
                    <div
                      key={`${currentRoutine.id}-${step.index}`}
                      className="absolute inset-0 transition-opacity duration-150"
                      style={{
                        opacity,
                        zIndex: opacity > 0.05 ? 10 : 1,
                        pointerEvents: 'none'
                      }}
                    >
                      <Illustration imageKey={step.image} isMirrored={isImageMirrored} />
                    </div>
                  );
                })}

                {/* Ambient vignette frame layout shadow */}
                <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/15 to-transparent pointer-events-none z-10" />
              </div>

            </div>
          </div>

          {/* COLUMN 2: LARGE INSTRUCTIONAL INFO DISPLAY */}
          <div className="lg:col-span-12 xl:col-span-7 flex flex-col justify-center space-y-8">
            
            {/* LARGE HEADER STEP COMPILER */}
            <div id="step-title-block" className="space-y-2">
              <h2 className={`font-display font-extrabold text-3xl sm:text-5xl ${uiTextPrimary} tracking-tight leading-tight`}>
                {currentRoutine.name}
              </h2>
            </div>

            {/* MAIN COUNTER & TIMER CIRCLE COMBINED BAR */}
            <div id="countdown-card" className={`${uiBgCard} p-6 sm:p-8 rounded-[32px] border ${uiBorder} shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden`}>
              <div className="flex-1 space-y-1">
                <span className={`text-xs font-bold ${uiTextAccent} uppercase tracking-wider block`}>
                  {currentRoutine.id === 'toracica' ? 'TIEMPO DE ESTIRAMIENTO TORÁCICO'
                    : currentRoutine.id === 'elongacion_triceps' ? 'TIEMPO DE ESTIRAMIENTO DE HOMBRO'
                    : currentRoutine.id === 'muneca_codo' && activeStep > 0 ? 'ELONGACIÓN DE EXTENSORES'
                    : 'TIEMPO DE CUMPLIMIENTO DE POSTURA'}
                </span>
                <p className={`text-2xl font-display font-bold ${uiTextPrimary}`}>
                  {currentRoutine.id === "respiracion"
                    ? ["Prepárese para comenzar", "Cierre los ojos suavemente", "Inhale profundamente por la nariz", "Sostenga el aire con calma", "Exhale lento y completamente"][activeStep] ?? "Respire conscientemente"
                    : (currentRoutine.id === "cervical" && (activeStep === 0 || activeStep === 3)) ||
                      (currentRoutine.id === "rotacion" && (activeStep === 0 || activeStep === 7)) ||
                      (currentRoutine.id === "toracica" && activeStep === 0) ||
                      (currentRoutine.id === "triceps" && activeStep === 0) ||
                      (currentRoutine.id === "elongacion_triceps" && activeStep === 0) ||
                      (currentRoutine.id === "muneca_codo" && activeStep === 0) ||
                      (currentRoutine.id === "rotacion_tronco" && activeStep === 0) ||
                      (currentRoutine.id === "piriforme" && activeStep === 0) ||
                      (currentRoutine.id === "bajando_tierra" && activeStep === 0)
                    ? "Póngase en posición"
                    : phase === 'hold'
                    ? "Sostenga el estiramiento fijamente"
                    : "Relaje hombros mientras la postura cambia"}
                </p>
                <div className={`flex items-center gap-2 text-xs font-semibold ${uiTextAccent} mt-1`}>
                  <span>Recomendación médica de pausa:</span>
                  <span className={`bg-[#111111]/12 py-0.5 px-2.5 rounded-full font-bold`}>{currentStepData.duration} total</span>
                </div>

                {/* VISUAL PLAY PAUSE INTERACTIVE CONTROLS */}
                <div className={`flex flex-wrap items-center gap-2.5 pt-3.5 border-t border-[#F4F4F5] mt-3.5`}>
                  <button
                    id="btn-toggle-play"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${
                      isPlaying
                        ? 'bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#333333] border-[#E4E4E7]'
                        : 'bg-[#111111] hover:bg-[#000000] text-white border-transparent shadow-[#111111]/20 shadow-md'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className={`w-3.5 h-3.5 fill-[#111111] text-current`} />
                        <span>Pausar Rotación</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white text-white" />
                        <span>{currentRoutine.id === 'respiracion' && activeStep === 0 ? 'Iniciar Ciclo' : 'Reanudar Ciclo'}</span>
                      </>
                    )}
                  </button>

                  <button
                    id="btn-restart-phase"
                    onClick={restartPhaseTimer}
                    title="Reiniciar fase"
                    aria-label="Reiniciar fase"
                    className={`flex items-center justify-center w-9 h-9 rounded-full bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#333333] border-[#E4E4E7] border transition-all duration-300`}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Big Signage Countdown Timer */}
              <div id="progress-timer-circle" className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="44"
                    stroke={'#F4F4F5'}
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="44"
                    stroke={phase === 'hold' ? "#BFD732" : "#111111"}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={2 * Math.PI * 44 * (1 - ringProgress / 100)}
                    style={{ transition: 'stroke 200ms linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-display font-extrabold ${uiTextPrimary} font-mono leading-none`}>
                    {secondsRemaining}
                  </span>
                  <span className={`text-[9px] font-bold ${uiTextMuted} uppercase tracking-wider mt-1`}>
                    SEGUNDOS
                  </span>
                </div>
              </div>
            </div>

            {/* MASTER INSTRUCTIONS: TEXT FOCUS */}
            <div className="space-y-6">
              
              {/* Technical Instruction - Big display */}
              <div id="action-instruction-block" className={`${uiBgActionBlock} border-l-4 p-6 rounded-r-[24px] shadow-xs`}>
                <h4 className={`text-xs uppercase font-extrabold tracking-widest ${uiTextAccent} mb-2`}>
                  ¿QUÉ DEBE HACER AHORA?
                </h4>
                <p className={`text-xl font-bold ${uiTextPrimary} leading-relaxed`}>
                  {currentStepData.actionInstruction}
                </p>
              </div>

              {/* Anatomy context description */}
              <div className="px-2">
                <h4 className={`text-xs uppercase font-bold tracking-widest ${uiTextMuted} mb-2`}>
                  DETALLE DE LA POSTURA
                </h4>
                <p className={`text-base ${uiTextSecondary} font-light leading-relaxed`}>
                  {currentStepData.description}
                </p>
              </div>

            </div>

            {/* QUEUE TIMELINE OF STEPS */}
            <div id="timeline-block" className="pt-4">
              <h4 className={`text-xs font-bold tracking-wider ${uiTextMuted} uppercase mb-3`}>SECUENCIA DE MOVIMIENTO ({currentRoutine.name})</h4>
              <div className="grid grid-cols-4 gap-2">
                {currentRoutine.steps.map((step) => {
                  const isActive = activeStep === step.index;
                  const isPast = activeStep > step.index;
                  return (
                    <button
                      key={step.index}
                      onClick={() => {
                        setIsPlaying(false);
                        setActiveStep(step.index);
                        setPrevStep(step.index);
                        setPhase('hold');
                        phaseElapsedRef.current = 0;
                        setRingProgress(0);
                        setSecondsRemaining(getStepHoldDuration(step.index, routineIndex));
                        setSliderValue(step.index);
                      }}
                      className={`p-3 rounded-2xl border text-center transition-all duration-300 text-left ${
                        isActive
                          ? `${uiBgActive} ${uiTextActive} shadow-sm`
                          : isPast
                            ? `bg-[#FAFAFA]/60 border-[#E4E4E7]/70 text-[#8a8a8a]`
                            : `bg-white border-[#EAEAEC] text-[#333333] hover:bg-white/90`
                      }`}
                    >
                      <div className="text-[9px] uppercase tracking-wider opacity-80">Fase {step.index + 1}</div>
                      <div className="text-xs font-bold truncate mt-0.5 leading-tight">{step.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
        </>
        )}

      </main>

      {/* 3. FOOTER SIGNAGE STATUS */}
      <footer id="app-footer" className="w-full bg-[#111111] py-4 px-8 shrink-0 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/70">
        {/* Logo lateral izquierdo — Insyso, empresa del servicio de Salud Ocupacional */}
        <img
          src={asset('/images/logo_insyso_oscuro.png')}
          alt="Insyso"
          className="h-14 object-contain"
        />

        <div className="hidden md:block w-px h-10 bg-white/20" />

        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-[#BFD732]" />
            <span>Pantalla dinámica para pausas activas - 2026</span>
          </div>
          <span className="hidden md:inline font-light text-white/30">|</span>
          <p className="font-medium text-white/80">© 2026 Dr. Emiliano Figuerón</p>
          <span className="hidden md:inline font-light text-white/30">|</span>
          <p className="font-medium text-white/80">Salud Ocupacional Globant Uruguay</p>
        </div>
      </footer>

    </div>
  );
}
