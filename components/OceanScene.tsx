"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Countdown } from "@/components/Countdown";
import { OceanCanvas, type OceanCanvasHandle } from "@/components/OceanCanvas";
import { EditorialStory, InvitationAct, type ScenePhase } from "@/components/EditorialStory";
import { EVENT, OCEAN_MEDIA } from "@/lib/event";

const ACT_LABELS = ["Oceano", "Fotografias", "Convite"] as const;
type Act = 0 | 1 | 2;

function WaveIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 14.3c2.1 0 2.1-2.5 4.2-2.5s2.1 2.5 4.2 2.5 2.1-2.5 4.2-2.5 2.1 2.5 4.2 2.5 2.1-2.5 4.2-2.5" />
      <path d="M2.5 19c2.1 0 2.1-2.5 4.2-2.5s2.1 2.5 4.2 2.5 2.1-2.5 4.2-2.5 2.1 2.5 4.2 2.5 2.1-2.5 4.2-2.5" />
      {active ? <path d="M7 5.3c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0" /> : <path d="M12 3.5v4" />}
    </svg>
  );
}

function phaseFor(index: Act, active: Act): ScenePhase {
  if (index === active) return "active";
  return index < active ? "before" : "after";
}

export function OceanScene() {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<OceanCanvasHandle>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fadeRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioStartedRef = useRef(false);
  const previousActRef = useRef<Act>(0);
  const [activeAct, setActiveAct] = useState<Act>(0);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const goToAct = useCallback((act: Act) => {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
    setActiveAct(act);
  }, []);

  useEffect(() => {
    const widthQuery = window.matchMedia(OCEAN_MEDIA.mobileQuery);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncWidth = () => setIsMobile(widthQuery.matches);
    const syncMotion = () => setReducedMotion(motionQuery.matches);
    syncWidth();
    syncMotion();
    widthQuery.addEventListener("change", syncWidth);
    motionQuery.addEventListener("change", syncMotion);
    return () => {
      widthQuery.removeEventListener("change", syncWidth);
      motionQuery.removeEventListener("change", syncMotion);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reducedMotion || activeAct !== 0) video.pause();
    else video.play().catch(() => { /* the color-graded background remains visible */ });
  }, [activeAct, isMobile, reducedMotion]);

  useEffect(() => {
    if (previousActRef.current === activeAct) return;
    previousActRef.current = activeAct;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".experience-scene.scene-active")?.focus({ preventScroll: true });
    });
  }, [activeAct]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, select, textarea")) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setActiveAct((current) => Math.min(2, current + 1) as Act);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setActiveAct((current) => Math.max(0, current - 1) as Act);
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveAct(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActiveAct(2);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  useEffect(() => () => {
    if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    void audioContextRef.current?.close();
  }, []);

  useEffect(() => {
    const pauseInBackground = () => {
      if (document.hidden && audioRef.current) {
        audioRef.current.pause();
        if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
        if (gainRef.current) gainRef.current.gain.value = 0;
        audioRef.current.volume = 0;
        setAudioOn(false);
      }
    };
    document.addEventListener("visibilitychange", pauseInBackground);
    return () => document.removeEventListener("visibilitychange", pauseInBackground);
  }, []);

  const fadeAudio = useCallback((target: number, duration: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
    const gain = gainRef.current;
    const beginning = gain ? gain.gain.value : audio.volume;
    const startAt = performance.now();
    const update = (now: number) => {
      const progress = Math.min((now - startAt) / duration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const level = Math.max(0, Math.min(1, beginning + (target - beginning) * eased));
      if (gain) gain.gain.value = level;
      else audio.volume = level;
      if (progress < 1) fadeRef.current = requestAnimationFrame(update);
      else {
        fadeRef.current = null;
        if (target === 0) audio.pause();
      }
    };
    fadeRef.current = requestAnimationFrame(update);
  }, []);

  const toggleSound = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioOn) {
      fadeAudio(0, 1600);
      setAudioOn(false);
      return;
    }
    try {
      if (!audioStartedRef.current) {
        audioStartedRef.current = true;
        try {
          const context = new AudioContext();
          const source = context.createMediaElementSource(audio);
          const highPass = context.createBiquadFilter();
          const warmth = context.createBiquadFilter();
          const softAir = context.createBiquadFilter();
          const gain = context.createGain();
          highPass.type = "highpass";
          highPass.frequency.value = 72;
          highPass.Q.value = 0.35;
          warmth.type = "lowshelf";
          warmth.frequency.value = 260;
          warmth.gain.value = -1.2;
          softAir.type = "highshelf";
          softAir.frequency.value = 2800;
          softAir.gain.value = -2.4;
          gain.gain.value = 0;
          source.connect(highPass).connect(warmth).connect(softAir).connect(gain);
          gain.connect(context.destination);
          audioContextRef.current = context;
          gainRef.current = gain;
        } catch {
          // Element volume is a fallback; the MP3 itself is mastered quietly.
        }
      }
      if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
      if (gainRef.current) gainRef.current.gain.value = 0;
      audio.volume = gainRef.current ? 1 : 0;
      const resumed = audioContextRef.current?.resume();
      const playing = audio.play();
      if (resumed) await resumed;
      await playing;
      setAudioOn(true);
      setAudioError(false);
      fadeAudio(0.26, 3600);
    } catch {
      setAudioOn(false);
      setAudioError(true);
    }
  };

  const moveParallax = (event: PointerEvent<HTMLElement>) => {
    if (reducedMotion || event.pointerType !== "mouse") return;
    const area = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - area.left) / area.width - 0.5;
    const y = (event.clientY - area.top) / area.height - 0.5;
    heroRef.current?.style.setProperty("--parallax-x", `${x * -15}px`);
    heroRef.current?.style.setProperty("--parallax-y", `${y * -9}px`);
  };

  const createRipple = (event: PointerEvent<HTMLElement>) => {
    const area = heroRef.current?.getBoundingClientRect();
    if (!area) return;
    canvasRef.current?.rippleAt(event.clientX - area.left, event.clientY - area.top);
  };

  const discover = (fromKeyboard = false) => {
    if (activeAct !== 0 || transitionTimerRef.current !== null) return;
    if (fromKeyboard) {
      const area = heroRef.current?.getBoundingClientRect();
      if (area) canvasRef.current?.rippleAt(area.width / 2, area.height * 0.62);
    }
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      setActiveAct(1);
    }, reducedMotion ? 0 : 360);
  };

  const oceanVideo = isMobile ? OCEAN_MEDIA.mobile : OCEAN_MEDIA.desktop;

  return (
    <main className="experience-shell" data-act={activeAct + 1}>
      <section
        className={`experience-scene hero scene-${phaseFor(0, activeAct)}`}
        id="inicio"
        ref={heroRef}
        onPointerMove={moveParallax}
        onPointerLeave={() => {
          heroRef.current?.style.setProperty("--parallax-x", "0px");
          heroRef.current?.style.setProperty("--parallax-y", "0px");
        }}
        aria-hidden={activeAct !== 0}
        aria-label="Save the Date — Bárbara e Felipe"
        tabIndex={-1}
      >
        <div className="film-frame" aria-hidden="true">
          <div className="film-poster" />
          {!reducedMotion && (
            <video
              key={oceanVideo}
              ref={videoRef}
              className="sea-film"
              src={oceanVideo}
              muted loop playsInline autoPlay preload="auto"
              aria-hidden="true"
            />
          )}
          <div className="sea-color-grade" />
          <div className="light-leak" />
          <OceanCanvas ref={canvasRef} />
          <div className="film-vignette" />
        </div>

        <button
          className="ocean-touch-surface"
          type="button"
          aria-label="Criar uma ondulação e descobrir nossas fotografias"
          onPointerDown={createRipple}
          onClick={(event) => discover(event.detail === 0)}
        />

        <header className="masthead">
          <button className="brand-mark" type="button" onClick={() => goToAct(0)} aria-label="Bárbara e Felipe, início">B <span>·</span> F</button>
          <span className="masthead-meta">O NOSSO PRÓXIMO CAPÍTULO</span>
          <button
            className={`sound-toggle ${audioOn ? "is-on" : ""}`}
            data-audio-state={audioOn ? "playing" : "paused"}
            type="button"
            aria-label={audioOn ? "Desligar som ambiente" : "Ouvir praia tranquila com ondas suaves e gaivotas ao longe"}
            aria-pressed={audioOn}
            onClick={toggleSound}
          >
            <WaveIcon active={audioOn} />
            <span>{audioOn ? "SOM LIGADO" : "OUVIR A PRAIA"}</span>
            {audioOn && <span className="sound-live" aria-hidden="true"><i /><i /><i /></span>}
          </button>
        </header>

        <div className="hero-content">
          <p className="hero-eyebrow reveal-item reveal-1">SAVE THE DATE</p>
          <div className="hero-identity reveal-item reveal-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bf-monogram" src="/media/bf-monogram.svg" alt="Monograma B e F" draggable="false" />
          </div>
          <p className="hero-month reveal-item reveal-3"><span>{EVENT.numericLabel}</span></p>
          <div className="hero-countdown reveal-item reveal-4"><Countdown /></div>
          <p className="hero-names reveal-item reveal-5">{EVENT.names.toUpperCase()}</p>
        </div>

        <div className="hero-bottom">
          <span className="hero-bottom-note" aria-live="polite">{audioError ? "TOQUE NOVAMENTE PARA ATIVAR O SOM" : "UM INSTANTE PARA SENTIR O MAR"}</span>
          <button className="discovery-cue" type="button" onClick={() => discover(true)}>
            <span>TOQUE PARA DESCOBRIR</span><span className="scroll-line" aria-hidden="true" />
          </button>
        </div>
      </section>

      <EditorialStory phase={phaseFor(1, activeAct)} onAdvance={() => goToAct(2)} />
      <InvitationAct phase={phaseFor(2, activeAct)} onRestart={() => goToAct(0)} />

      <nav className="act-progress" aria-label="Navegação entre atos">
        {ACT_LABELS.map((label, index) => (
          <button
            key={label}
            type="button"
            className={activeAct === index ? "is-current" : ""}
            aria-label={`Ir para ${label}`}
            aria-current={activeAct === index ? "step" : undefined}
            onClick={() => goToAct(index as Act)}
          ><span /></button>
        ))}
      </nav>
      <p className="scene-announcer" aria-live="polite">{`Ato ${activeAct + 1} de 3: ${ACT_LABELS[activeAct]}`}</p>

      <audio
        ref={audioRef}
        src="/media/mare-ambiente-suave.mp3"
        loop
        preload="none"
        onError={() => { setAudioError(true); setAudioOn(false); }}
      />
    </main>
  );
}
