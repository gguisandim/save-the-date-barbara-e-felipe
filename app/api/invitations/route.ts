import { NextRequest, NextResponse } from "next/server";
import { validateInvitationAddress } from "@/lib/invitation";
import { countRecentSubmissions, hashClientAddress, saveInvitation } from "@/lib/invitations-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 16_000;
const MAX_SUBMISSIONS_PER_HOUR = 5;

function errorResponse(message: string, status: number, fields?: object) {
  return NextResponse.json({ ok: false, message, fields }, { status });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) return errorResponse("Requisição muito grande.", 413);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("Formato de envio inválido.", 415);
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse("Origem de envio inválida.", 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Não foi possível ler os dados enviados.", 400);
  }

  // Campo-isca: pessoas nunca o veem, robôs costumam preenchê-lo.
  if (typeof payload.company === "string" && payload.company.trim()) {
    return errorResponse("Não foi possível concluir o envio.", 400);
  }

  const validation = validateInvitationAddress(payload);
  if (!validation.success) {
    return errorResponse("Revise os campos destacados.", 422, validation.errors);
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = forwardedFor || request.headers.get("x-real-ip") || "unknown";

  try {
    const ipHash = hashClientAddress(clientAddress);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    if (countRecentSubmissions(ipHash, oneHourAgo) >= MAX_SUBMISSIONS_PER_HOUR) {
      return errorResponse("Muitas tentativas. Aguarde um pouco antes de enviar novamente.", 429);
    }
    const saved = saveInvitation(validation.data, ipHash);
    return NextResponse.json({ ok: true, reference: saved.id }, { status: 201 });
  } catch (error) {
    console.error("Invitation persistence failed", error);
    return errorResponse("Não foi possível guardar seu endereço agora. Tente novamente em instantes.", 500);
  }
}
