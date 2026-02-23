import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderShippedEmail(
  to: string,
  order: any
) {
  try {
    await resend.emails.send({
      from: "Office Gama <giovannigarcia211090012@gmail.com>",
      to,
      subject: `Tu pedido ha sido enviado 🚚`,
      html: `
        <div style="font-family: Arial; padding:20px;">
          <h2>Tu pedido fue enviado 🚚</h2>
          <p><strong>Pedido:</strong> #${order.id.slice(0,8)}</p>
          <p><strong>Total:</strong> $${order.total} MXN</p>

          <h3>Dirección de envío:</h3>
          <p>
            ${order.full_name}<br/>
            ${order.address}<br/>
            ${order.city}<br/>
            CP: ${order.postal_code}<br/>
            Tel: ${order.phone}
          </p>

          <p>Gracias por tu compra 💙</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error enviando correo:", error);
  }
}