export const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

export type InvitationAddress = {
  fullName: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type InvitationValidation =
  | { success: true; data: InvitationAddress }
  | { success: false; errors: Partial<Record<keyof InvitationAddress, string>> };

const LIMITS: Record<keyof InvitationAddress, number> = {
  fullName: 120,
  cep: 8,
  street: 160,
  number: 20,
  complement: 100,
  neighborhood: 100,
  city: 100,
  state: 2,
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function validateInvitationAddress(input: unknown): InvitationValidation {
  const source = typeof input === "object" && input !== null ? input as Record<string, unknown> : {};
  const data: InvitationAddress = {
    fullName: cleanText(source.fullName, LIMITS.fullName),
    cep: cleanText(source.cep, 12).replace(/\D/g, "").slice(0, LIMITS.cep),
    street: cleanText(source.street, LIMITS.street),
    number: cleanText(source.number, LIMITS.number),
    complement: cleanText(source.complement, LIMITS.complement),
    neighborhood: cleanText(source.neighborhood, LIMITS.neighborhood),
    city: cleanText(source.city, LIMITS.city),
    state: cleanText(source.state, LIMITS.state).toUpperCase(),
  };
  const errors: Partial<Record<keyof InvitationAddress, string>> = {};

  if (data.fullName.length < 3 || !data.fullName.includes(" ")) errors.fullName = "Informe o nome completo.";
  if (!/^\d{8}$/.test(data.cep)) errors.cep = "Informe um CEP válido com 8 números.";
  if (data.street.length < 2) errors.street = "Informe a rua ou avenida.";
  if (!data.number) errors.number = "Informe o número.";
  if (data.neighborhood.length < 2) errors.neighborhood = "Informe o bairro.";
  if (data.city.length < 2) errors.city = "Informe a cidade.";
  if (!BRAZILIAN_STATES.includes(data.state as (typeof BRAZILIAN_STATES)[number])) errors.state = "Selecione o estado.";

  return Object.keys(errors).length > 0 ? { success: false, errors } : { success: true, data };
}
