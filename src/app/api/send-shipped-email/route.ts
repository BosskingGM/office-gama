import { NextResponse } from "next/server";
import { sendOrderShippedEmail } from "@/lib/email";

export async function POST(req: Request) {
  const order = await req.json();

  console.log("📧 Intentando enviar correo a:", order.user_email);

  try {
    await sendOrderShippedEmail(order.user_email, order);
    console.log("✅ Correo enviado correctamente");
  } catch (error) {
    console.error("❌ Error enviando correo:", error);
  }

  return NextResponse.json({ ok: true });
}