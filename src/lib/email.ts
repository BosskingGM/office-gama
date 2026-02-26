import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function sendOrderShippedEmail(orderId: string) {
  try {
    // 🔎 Traer la orden
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Error trayendo orden:", orderError);
      return;
    }

    // 🔎 Traer productos con tu estructura real
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        quantity,
        price,
        product_variants (
          products (
            name
          )
        )
      `)
      .eq("order_id", orderId);

    if (itemsError) {
      console.error("Error trayendo items:", itemsError);
      return;
    }

    // 🧾 Construir tabla de productos
    const productsHtml = items
      ?.map(
        (item: any) => `
          <tr>
            <td style="padding:10px 0;">
              ${item.product_variants?.products?.name || "Producto"}
            </td>
            <td style="text-align:center;">
              ${item.quantity}
            </td>
            <td style="text-align:right;">
              $${item.price} MXN
            </td>
          </tr>
        `
      )
      .join("");

    // 📧 Enviar correo profesional
    await resend.emails.send({
      from: "Office Gama <ventas@officegama.com>",
      to: order.user_email,
      subject: `Tu pedido #${orderId.slice(0, 8)} ha sido enviado 🚚`,
      html: `
        <div style="font-family: Arial, sans-serif; background:#f3f4f6; padding:40px;">
          <div style="max-width:600px; margin:auto; background:white; padding:30px; border-radius:12px; border:1px solid #e5e7eb;">
            
            <h2 style="color:#111827;">
              Hola ${order.full_name}, 👋
            </h2>

            <p style="color:#374151;">
              ¡Buenas noticias! Tu pedido ya fue enviado y está en camino.
            </p>

            <p>
              <strong>Pedido:</strong> #${orderId.slice(0, 8)}<br/>
              <strong>Total:</strong> $${order.total} MXN
            </p>

            <hr style="margin:25px 0;" />

            <h3>🛍 Productos enviados:</h3>

            <table width="100%" style="border-collapse:collapse; font-size:14px;">
              <thead>
                <tr style="border-bottom:1px solid #e5e7eb;">
                  <th align="left">Producto</th>
                  <th align="center">Cantidad</th>
                  <th align="right">Precio</th>
                </tr>
              </thead>
              <tbody>
                ${productsHtml}
              </tbody>
            </table>

            <hr style="margin:25px 0;" />

            <h3>📦 Dirección de envío:</h3>
            <p style="line-height:1.6; color:#374151;">
              ${order.full_name}<br/>
              ${order.address}<br/>
              ${order.city}<br/>
              CP: ${order.postal_code}<br/>
              Tel: ${order.phone}
            </p>

            <p style="margin-top:25px; font-size:14px; color:#6b7280;">
              Gracias por confiar en <strong>Office Gama</strong> 💙
            </p>

          </div>
        </div>
      `,
    });

    console.log("Correo profesional enviado ✅");

  } catch (err) {
    console.error("Error enviando correo:", err);
  }
}