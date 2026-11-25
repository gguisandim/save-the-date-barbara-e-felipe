"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { InvitationDialog } from "@/components/InvitationDialog";

const imageSizes = {
  portrait: "(max-width: 767px) 86vw, 42vw",
  small: "(max-width: 767px) 58vw, 28vw",
  wide: "100vw",
};

function StoryImage({ src, alt, className, sizes = imageSizes.portrait, depth = 0 }: { src: string; alt: string; className: string; sizes?: string; depth?: number }) {
  return (
    <figure className={`story-photo ${className}`} data-reveal data-parallax={depth || undefined}>
      <Image src={src} alt={alt} fill sizes={sizes} quality={88} />
    </figure>
  );
}

export function EditorialStory() {
  const storyRef = useRef<HTMLElement>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const root = storyRef.current;
    if (!root) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (reducedMotion) {
      revealNodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) entry.target.classList.add("is-visible");
    }, { rootMargin: "0px 0px -10%", threshold: 0.08 });
    revealNodes.forEach((node) => observer.observe(node));

    const parallaxNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]"));
    let frame = 0;
    const updateParallax = () => {
      frame = 0;
      const viewportCenter = window.innerHeight / 2;
      for (const node of parallaxNodes) {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -150 || rect.top > window.innerHeight + 150) continue;
        const depth = Number(node.dataset.parallax || 0);
        const offset = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - viewportCenter) / window.innerHeight));
        node.style.setProperty("--scroll-shift", `${offset * depth}px`);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateParallax);
    };
    updateParallax();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="editorial-story" id="sobre" ref={storyRef} aria-label="Nossa história em fotografias">
      <div className="story-opening">
        <p className="chapter-label" data-reveal>CAPÍTULO I · O CASAL</p>
        <div className="opening-copy" data-reveal>
          <p>Entre o vento e o mar,</p>
          <h2>escolhemos<br /><em>um ao outro.</em></h2>
        </div>
        <StoryImage src="/photos/img_6360.webp" alt="Bárbara e Felipe se olhando no veleiro" className="portrait-main" depth={-24} />
        <StoryImage src="/photos/img_6355.webp" alt="Bárbara e Felipe se beijando" className="portrait-secondary" sizes={imageSizes.small} depth={18} />
        <p className="opening-note" data-reveal>Dois caminhos, a mesma direção.<br />Uma história que segue em frente.</p>
      </div>

      <div className="small-moments">
        <header className="moments-heading" data-reveal>
          <p className="chapter-label">CAPÍTULO II · PEQUENOS MOMENTOS</p>
          <h2>É no quase silêncio<br /><em>que mora o amor.</em></h2>
        </header>
        <StoryImage src="/photos/007.webp" alt="As mãos de Bárbara e Felipe entrelaçadas" className="moment-hands" sizes={imageSizes.small} depth={22} />
        <StoryImage src="/photos/009.webp" alt="Felipe sorrindo sob o sol" className="moment-smile" sizes={imageSizes.small} depth={-18} />
        <StoryImage src="/photos/031.webp" alt="Bárbara e Felipe juntos no barco" className="moment-together" depth={28} />
        <StoryImage src="/photos/030.webp" alt="Olhar carinhoso entre Bárbara e Felipe" className="moment-look" sizes={imageSizes.small} depth={-20} />
        <StoryImage src="/photos/033.webp" alt="Pés tocando a água do mar" className="moment-water" sizes={imageSizes.small} depth={16} />
        <p className="moments-note" data-reveal>Gestos pequenos.<br />Memórias imensas.</p>
      </div>

      <div className="horizon-chapter">
        <header className="horizon-heading" data-reveal>
          <p className="chapter-label">CAPÍTULO III · O HORIZONTE</p>
          <h2>O futuro tem<br /><em>a cor do pôr do sol.</em></h2>
        </header>
        <StoryImage src="/photos/044.webp" alt="Bárbara e Felipe no veleiro ao pôr do sol" className="horizon-sunset" depth={-22} />
        <StoryImage src="/photos/046.webp" alt="Bárbara abraça Felipe diante do horizonte" className="horizon-embrace" sizes={imageSizes.small} depth={22} />
        <StoryImage src="/photos/img_6354.webp" alt="Bárbara e Felipe apontam para o horizonte no veleiro" className="horizon-sail" depth={-14} />
        <p className="horizon-quote" data-reveal>“E, de repente, todo horizonte<br />pareceu um convite.”</p>
      </div>

      <div className="closing-chapter" id="convite">
        <Image src="/photos/img_6359.webp" alt="Felipe beija Bárbara no veleiro durante o pôr do sol" fill sizes={imageSizes.wide} quality={90} />
        <div className="closing-grade" aria-hidden="true" />
        <div className="closing-copy" data-reveal>
          <p className="chapter-label">CAPÍTULO IV · CONTINUA</p>
          <h2>Queremos você<br /><em>perto de nós.</em></h2>
          <p>Deixe seu endereço para receber o convite deste novo capítulo.</p>
          <button className="invitation-cta" type="button" onClick={() => setFormOpen(true)}>
            <span>Quero receber meu convite</span><span aria-hidden="true">→</span>
          </button>
          <small>O formulário não representa confirmação de presença.</small>
        </div>
        <a href="#inicio" className="back-to-top">VOLTAR AO INÍCIO <span aria-hidden="true">↑</span></a>
      </div>

      <InvitationDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </section>
  );
}
