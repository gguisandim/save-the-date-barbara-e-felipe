"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";
import { InvitationDialog } from "@/components/InvitationDialog";

export type ScenePhase = "before" | "active" | "after";

type PhotoActProps = {
  phase: ScenePhase;
  onAdvance: () => void;
};

export function EditorialStory({ phase, onAdvance }: PhotoActProps) {
  const continueFromComposition = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    onAdvance();
  };

  return (
    <section
      className={`experience-scene photo-act scene-${phase}`}
      aria-hidden={phase !== "active"}
      aria-label="Retratos de Bárbara e Felipe"
      tabIndex={-1}
      onClick={continueFromComposition}
    >
      <div className="photo-wash" aria-hidden="true" />
      <header className="photo-copy">
        <p>ENTRE O VENTO E O MAR</p>
        <h2>escolhemos<br /><em>um ao outro.</em></h2>
      </header>

      <figure className="act-photo act-photo-main">
        <Image
          src="/photos/img_6360.webp"
          alt="Bárbara e Felipe se olhando no veleiro"
          fill
          sizes="(max-width: 767px) 74vw, 36vw"
          quality={90}
        />
      </figure>
      <figure className="act-photo act-photo-detail">
        <Image
          src="/photos/007.webp"
          alt="As mãos de Bárbara e Felipe entrelaçadas"
          fill
          sizes="(max-width: 767px) 38vw, 25vw"
          quality={88}
        />
      </figure>
      <figure className="act-photo act-photo-sunset">
        <Image
          src="/photos/044.webp"
          alt="Bárbara e Felipe no veleiro ao pôr do sol"
          fill
          sizes="(max-width: 767px) 45vw, 26vw"
          quality={90}
        />
      </figure>

      <button className="scene-continue" type="button" onClick={onAdvance}>
        <span>Ver o convite</span><span className="button-rule" aria-hidden="true" />
      </button>
      <p className="composition-hint" aria-hidden="true">TOQUE NA COMPOSIÇÃO PARA CONTINUAR</p>
    </section>
  );
}

type InvitationActProps = {
  phase: ScenePhase;
  onRestart: () => void;
};

export function InvitationAct({ phase, onRestart }: InvitationActProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <section
      className={`experience-scene closing-chapter scene-${phase}`}
      aria-hidden={phase !== "active"}
      id="convite"
      tabIndex={-1}
    >
      <Image
        src="/photos/img_6359.webp"
        alt="Felipe beija Bárbara no veleiro durante o pôr do sol"
        fill
        sizes="100vw"
        quality={90}
      />
      <div className="closing-grade" aria-hidden="true" />
      <div className="closing-copy">
        <h2>Queremos você<br /><em>perto de nós.</em></h2>
        <p>Deixe seu endereço para receber o convite deste novo capítulo.</p>
        <button className="invitation-cta" type="button" onClick={() => setFormOpen(true)}>
          <span>Quero receber meu convite</span><span className="button-rule" aria-hidden="true" />
        </button>
        <small>O formulário não representa confirmação de presença.</small>
      </div>
      <button className="back-to-top" type="button" onClick={onRestart}>VOLTAR AO INÍCIO</button>
      <InvitationDialog open={formOpen} onClose={() => setFormOpen(false)} />
    </section>
  );
}
