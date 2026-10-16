import { NextResponse } from "next/server";
import { sendOrderConfirmationEmail, sendOrderShippedEmail } from "@/lib/email";
import { getUserFromRequest, isAdminUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Solo un administrador con sesión iniciada puede disparar este correo.
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (!(await isAdminUser(user.id))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const orderId = body?.orderId;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "orderId requerido" },
        { status: 400 }
      );
    }

    // "approved" = pago por transferencia aprobado; por defecto, aviso de envío.
    const sent =
      body?.kind === "approved"
        ? await sendOrderConfirmationEmail(orderId)
        : await sendOrderShippedEmail(orderId);

    if (!sent) {
      return NextResponse.json(
        { error: "No se pudo enviar el correo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error enviando correo:", error);
    return NextResponse.json(
      { error: "Error enviando correo" },
      { status: 500 }
    );
  }
}
