import { NextResponse } from "next/server";
import { sendOrderShippedEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId requerido" },
        { status: 400 }
      );
    }

    await sendOrderShippedEmail(orderId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error enviando correo:", error);
    return NextResponse.json(
      { error: "Error enviando correo" },
      { status: 500 }
    );
  }
}