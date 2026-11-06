"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Countdown } from "@/components/Countdown";
import { OceanCanvas } from "@/components/OceanCanvas";
import { EVENT } from "@/lib/event";

function WaveIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 14.3c2.1 0 2.1-2.5 4.2-2.5s2.1 2.5 4.2 2.5 2.1-2.5 4.2-2.5 2.1 2.5 4.2 2.5 2.1-2.5 4.2-2.5" />
      <path d="M2.5 19c2.1 0 2.1-2.5 4.2-2.5s2.1 2.5 4.2 2.5 2.1-2.5 4.2-2.5 2.1 2.5 4.2 2.5 2.1-2.5 4.2-2.5" />
      {active ? <path d="M7 5.3c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0" /> : <path d="M12 3.5v4" />}
    </svg>
  );
}

/** Ocean-first save-the-date. Local video always runs as a lightweight fallback. */
export function OceanScene() {
  const heroRef = useRef<HTMLElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fadeRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioStartedRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteError, setRemoteError] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    const widthQuery = window.matchMedia("(max-width: 767px)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncWidth = () => { setIsMobile(widthQuery.matches); setRemoteReady(false); setRemoteError(false); };
    const syncMotion = () => setReducedMotion(motionQuery.matches);
    syncWidth(); syncMotion();
    widthQuery.addEventListener("change", syncWidth);
    motionQuery.addEventListener("change", syncMotion);
    return () => {
      widthQuery.removeEventListener("change", syncWidth);
      motionQuery.removeEventListener("change", syncMotion);
    };
  }, []);

  useEffect(() => {
    for (const video of [localVideoRef.current, remoteVideoRef.current]) {
      if (!video) continue;
      if (reducedMotion) video.pause();
      else video.play().catch(() => { /* poster remains visible */ });
    }
  }, [isMobile, reducedMotion]);

  useEffect(() => {
    return () => {
      if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
      void audioContextRef.current?.close();
    };
  }, []);

  // Pause sound when the page loses visibility, so background tabs do not keep playing surf.
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
    // Web Audio gain is reliable on iOS, where HTMLMediaElement.volume may be fixed.
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

  const resumeLocalVideo = () => {
    setRemoteReady(false);
    localVideoRef.current?.play().catch(() => { /* poster is still available */ });
  };

  const showRemoteVideo = () => {
    setRemoteReady(true);
    localVideoRef.current?.pause(); // Avoid two video decoders on mobile.
  };

  const toggleSound = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioOn) {
      fadeAudio(0, 850);
      setAudioOn(false);
      return;
    }
    try {
      if (!audioStartedRef.current) {
        audioStartedRef.current = true;
        try {
          const context = new AudioContext();
          const source = context.createMediaElementSource(audio);
          const gain = context.createGain();
          gain.gain.value = 0;
          source.connect(gain);
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
      // Both calls start synchronously inside the click gesture (mobile Safari).
      const resumed = audioContextRef.current?.resume();
      const playing = audio.play();
      if (resumed) await resumed;
      await playing;
      setAudioOn(true);
      setAudioError(false);
      // Deliberately less prominent than the original surf audio.
      fadeAudio(0.5, 2200);
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

  const localVideo = isMobile ? EVENT.localVideoMobile : EVENT.localVideoDesktop;
  const poster = isMobile ? EVENT.posterMobile : EVENT.posterDesktop;
  const remoteVideo = isMobile ? EVENT.oceanVideoMobile : EVENT.oceanVideoDesktop;

  return (
    <main>
      <section
        className="hero" id="inicio" ref={heroRef}
        onPointerMove={moveParallax}
        onPointerLeave={() => {
          heroRef.current?.style.setProperty("--parallax-x", "0px");
          heroRef.current?.style.setProperty("--parallax-y", "0px");
        }}
        aria-label="Save the Date — Bárbara e Felipe"
      >
        <div className="film-frame" aria-hidden="true">
          <div className="film-poster" />
          {!reducedMotion && (
            <>
              <video
                key={`local-${localVideo}`}
                ref={localVideoRef}
                className="sea-film local-film"
                src={localVideo} poster={poster}
                muted loop playsInline autoPlay preload="auto"
                aria-hidden="true"
              />
              {!remoteError && (
                <video
                  key={`remote-${remoteVideo}`}
                  ref={remoteVideoRef}
                  className={`sea-film remote-film ${remoteReady ? "remote-ready" : ""}`}
                  src={remoteVideo}
                  muted loop playsInline autoPlay preload="metadata"
                  onPlaying={showRemoteVideo}
                  onWaiting={resumeLocalVideo}
                  onStalled={resumeLocalVideo}
                  onError={() => { setRemoteError(true); resumeLocalVideo(); }}
                  aria-hidden="true"
                />
              )}
            </>
          )}
          <div className="sea-color-grade" />
          <div className="light-leak" />
          <OceanCanvas />
          <div className="film-vignette" />
        </div>

        <header className="masthead">
          <a href="#inicio" className="brand-mark" aria-label="Bárbara e Felipe, voltar ao início">B <span>·</span> F</a>
          <span className="masthead-meta">O NOSSO PRÓXIMO CAPÍTULO</span>
          <button
            className={`sound-toggle ${audioOn ? "is-on" : ""}`}
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
            {/* Monograma vetorial original fornecido para Bárbara e Felipe. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="bf-monogram" src="/media/bf-monogram.svg" alt="Monograma B e F" draggable="false" />
          </div>
          <p className="hero-month reveal-item reveal-3"><span>{EVENT.monthLabel}</span><span className="month-dot">·</span><span>{EVENT.year}</span></p>
          <div className="hero-countdown reveal-item reveal-4"><Countdown /></div>
          <p className="hero-names reveal-item reveal-5">{EVENT.names.toUpperCase()}</p>
        </div>

        <div className="hero-bottom">
          <span className="hero-bottom-note" aria-live="polite">{audioError ? "TOQUE NOVAMENTE PARA ATIVAR O SOM" : "UM INSTANTE PARA SENTIR O MAR"}</span>
          <a className="scroll-cue" href="#sobre" aria-label="Rolar para descobrir mais">
            <span>DESLIZE PARA DESCOBRIR</span><span className="scroll-line" aria-hidden="true" />
          </a>
        </div>
      </section>

      <section id="sobre" className="epilogue" aria-labelledby="epilogue-title">
        <div className="epilogue-orb" aria-hidden="true" />
        <span className="epilogue-index">01 / 01</span>
        <div className="epilogue-content">
          <div className="epilogue-overline"><span className="small-line" /> A NOSSA HISTÓRIA CONTINUA <span className="small-line" /></div>
          <h2 id="epilogue-title">Há momentos<br /><em>que ficam para sempre.</em></h2>
          <p>Em março de 2027, temos um novo capítulo para celebrar.</p>
          <div className="epilogue-separator" aria-hidden="true"><span /><span className="diamond">✧</span><span /></div>
          <p className="epilogue-signature">Bárbara <i>&</i> Felipe</p>
          <p className="epilogue-footnote">MAIS DETALHES EM BREVE</p>
        </div>
        <a href="#inicio" className="back-to-top">VOLTAR AO INÍCIO <span aria-hidden="true">↑</span></a>
      </section>
      <audio
        ref={audioRef} src="/media/brisa-e-gaivotas.mp3" loop preload="none"
        onError={() => { setAudioError(true); setAudioOn(false); }}
      />
    </main>
  );
}
