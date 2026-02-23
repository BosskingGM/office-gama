import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, orderId } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    console.log("📧 Enviando correo a:", email);

    await resend.emails.send({
      from: "Office GaMa <onboarding@resend.dev>",
      to: email,
      subject: "Tu pedido ha sido enviado 📦",
      html: `
        <h2>¡Tu pedido va en camino!</h2>
        <p>Pedido ID: <strong>${orderId}</strong></p>
        <p>Gracias por comprar en Office GaMa.</p>
      `,
    });

    console.log("✅ Correo enviado correctamente");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error enviando correo:", error);
    return NextResponse.json({ error: "Error enviando correo" }, { status: 500 });
  }
}