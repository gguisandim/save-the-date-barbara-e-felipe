import { NextRequest, NextResponse } from "next/server";
import { validateInvitationAddress } from "@/lib/invitation";
import { hashClientAddress, saveInvitationWithRateLimit } from "@/lib/invitations-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 16_000;
const MAX_SUBMISSIONS_PER_HOUR = 5;

function errorResponse(message: string, status: number, fields?: object) {
  return NextResponse.json({ ok: false, message, fields }, { status });
}

function isAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";

  const allowedOrigins = new Set([request.nextUrl.origin]);
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) {
    try {
      allowedOrigins.add(new URL(configuredUrl).origin);
    } catch {
      // A malformed optional public URL must not make the write endpoint permissive.
    }
  }
  return allowedOrigins.has(origin);
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) return errorResponse("Requisição muito grande.", 413);
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("Formato de envio inválido.", 415);
  }
  if (!isAllowedOrigin(request)) {
    return errorResponse("Origem de envio inválida.", 403);
  }

  let payload: Record<string, unknown>;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
      return errorResponse("Requisição muito grande.", 413);
    }
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return errorResponse("Formato de envio inválido.", 400);
    }
    payload = parsed as Record<string, unknown>;
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
    const saved = saveInvitationWithRateLimit(
      validation.data,
      ipHash,
      oneHourAgo,
      MAX_SUBMISSIONS_PER_HOUR,
    );
    if (!saved) {
      return errorResponse("Muitas tentativas. Aguarde um pouco antes de enviar novamente.", 429);
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Invitation persistence failed", error);
    return errorResponse("Não foi possível guardar seu endereço agora. Tente novamente em instantes.", 500);
  }
}
