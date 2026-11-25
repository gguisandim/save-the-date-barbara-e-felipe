"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { WEDDING_DATE } from "@/lib/event";
import {
  BRAZILIAN_STATES,
  validateInvitationAddress,
  type InvitationAddress,
} from "@/lib/invitation";

type FormStatus = "idle" | "submitting" | "success" | "error";
type FieldErrors = Partial<Record<keyof InvitationAddress, string>>;

const INITIAL_FORM: InvitationAddress = {
  fullName: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function InvitationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "found" | "error">("idle");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const update = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const key = event.target.name as keyof InvitationAddress;
    const value = key === "cep" ? formatCep(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    if (status === "error") setStatus("idle");
  };

  const lookupCep = async () => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      setCepStatus("idle");
      return;
    }
    setCepStatus("loading");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(7000) });
      const address = await response.json();
      if (!response.ok || address.erro) throw new Error("CEP não encontrado");
      setForm((current) => ({
        ...current,
        street: address.logradouro || current.street,
        neighborhood: address.bairro || current.neighborhood,
        city: address.localidade || current.city,
        state: address.uf || current.state,
        complement: current.complement || address.complemento || "",
      }));
      setCepStatus("found");
    } catch {
      setCepStatus("error");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;
    setErrors({});
    setMessage("");
    const formElement = event.currentTarget;
    const company = new FormData(formElement).get("company")?.toString() || "";
    const validation = validateInvitationAddress({
      ...form,
      cep: form.cep.replace(/\D/g, ""),
    });

    if (!validation.success) {
      setErrors(validation.errors);
      setStatus("error");
      setMessage("Revise os campos destacados antes de continuar.");
      const firstInvalidField = Object.keys(validation.errors)[0];
      formElement.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`)?.focus();
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validation.data, company }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setErrors(result.fields || {});
        throw new Error(result.message || "Não foi possível enviar.");
      }
      setStatus("success");
      setForm(INITIAL_FORM);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar seu endereço.");
    }
  };

  const close = () => {
    if (status === "submitting") return;
    setStatus("idle");
    setErrors({});
    setMessage("");
    setCepStatus("idle");
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="invitation-dialog"
      aria-labelledby="invitation-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === dialogRef.current) close(); }}
    >
      <div className="invitation-sheet">
        <button className="dialog-close" type="button" onClick={close} aria-label="Fechar formulário">×</button>
        {status === "success" ? (
          <div className="form-success" role="status">
            <span className="success-mark" aria-hidden="true">BF</span>
            <p className="form-kicker">ENDEREÇO RECEBIDO</p>
            <h2>Recebemos seu endereço.</h2>
            <p>Em breve, nosso convite chegará até você!</p>
            <button className="text-button" type="button" onClick={close}>Voltar à nossa história</button>
          </div>
        ) : (
          <>
            <header className="form-header">
              <p className="form-kicker">BÁRBARA &amp; FELIPE · {WEDDING_DATE.numericLabel}</p>
              <h2 id="invitation-title">Nosso convite<br /><em>está a caminho.</em></h2>
              <p>Queremos que o nosso convite chegue até você. Preencha seus dados abaixo.</p>
            </header>
            <form className="address-form" onSubmit={submit} noValidate>
              <div className="honeypot" aria-hidden="true">
                <label>Empresa<input name="company" tabIndex={-1} autoComplete="off" /></label>
              </div>
              <Field label="Nome completo do destinatário" name="fullName" value={form.fullName} error={errors.fullName} onChange={update} autoComplete="name" />
              <div className="form-grid form-grid-cep">
                <Field label="CEP" name="cep" value={form.cep} error={errors.cep} onChange={update} onBlur={lookupCep} inputMode="numeric" autoComplete="postal-code" />
                <p className={`cep-feedback cep-${cepStatus}`} aria-live="polite">
                  {cepStatus === "loading" && "Buscando endereço…"}
                  {cepStatus === "found" && "Endereço encontrado. Você pode editá-lo."}
                  {cepStatus === "error" && "Não encontramos o CEP. Preencha o endereço manualmente."}
                </p>
              </div>
              <div className="form-grid form-grid-street">
                <Field label="Rua ou avenida" name="street" value={form.street} error={errors.street} onChange={update} autoComplete="address-line1" />
                <Field label="Número" name="number" value={form.number} error={errors.number} onChange={update} autoComplete="address-line2" />
              </div>
              <Field label="Complemento (opcional)" name="complement" value={form.complement} error={errors.complement} onChange={update} autoComplete="address-line3" required={false} />
              <div className="form-grid form-grid-place">
                <Field label="Bairro" name="neighborhood" value={form.neighborhood} error={errors.neighborhood} onChange={update} />
                <Field label="Cidade" name="city" value={form.city} error={errors.city} onChange={update} autoComplete="address-level2" />
                <label className={`form-field ${errors.state ? "has-error" : ""}`}>
                  <span>Estado</span>
                  <select
                    id="invitation-state"
                    name="state"
                    value={form.state}
                    onChange={update}
                    autoComplete="address-level1"
                    required
                    aria-invalid={Boolean(errors.state)}
                    aria-describedby={errors.state ? "invitation-state-error" : undefined}
                  >
                    <option value="">UF</option>
                    {BRAZILIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                  {errors.state && <small id="invitation-state-error">{errors.state}</small>}
                </label>
              </div>
              {status === "error" && <p className="form-error" role="alert">{message}</p>}
              <button className="submit-address" type="submit" disabled={status === "submitting"} aria-busy={status === "submitting"}>
                <span>{status === "submitting" ? "Guardando seu endereço…" : "Enviar meu endereço"}</span>
                <span className="button-rule" aria-hidden="true" />
              </button>
              <p className="form-disclaimer">Este formulário é somente para o envio do convite e não representa confirmação de presença.</p>
            </form>
          </>
        )}
      </div>
    </dialog>
  );
}

type FieldProps = {
  label: string;
  name: keyof InvitationAddress;
  value: string;
  error?: string;
  required?: boolean;
  inputMode?: "numeric";
  autoComplete?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
};

function Field({ label, name, value, error, required = true, ...inputProps }: FieldProps) {
  const fieldId = `invitation-${name}`;
  const errorId = `${fieldId}-error`;
  return (
    <label className={`form-field ${error ? "has-error" : ""}`}>
      <span>{label}</span>
      <input
        id={fieldId}
        name={name}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && <small id={errorId}>{error}</small>}
    </label>
  );
}
