import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SHIPPING_OPTIONS, type ShippingType } from "@/lib/shipping";
import { STORE_ADDRESS_FULL, STORE_MAPS_URL } from "@/lib/store";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Evita que texto escrito por el cliente (nombre, dirección...) se interprete como HTML.
function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Devuelve true si el correo se envió, false si algo falló.
export async function sendOrderShippedEmail(orderId: string): Promise<boolean> {
  try {
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Error trayendo orden:", orderError);
      return false;
    }

    if (!order.user_email) {
      console.error("El pedido no tiene correo del cliente:", orderId);
      return false;
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(`
        quantity,
        price,
        product_name,
        variant_name,
        product_variants (
          model_name,
          products (
            name
          )
        )
      `)
      .eq("order_id", orderId);

    if (itemsError) {
      console.error("Error trayendo items:", itemsError);
      return false;
    }

    const productsHtml = (items || [])
      .map((item: any) => {
        const variant = Array.isArray(item.product_variants)
          ? item.product_variants[0]
          : item.product_variants;
        const product = Array.isArray(variant?.products)
          ? variant.products[0]
          : variant?.products;

        // Se prefiere el nombre guardado al comprar; si no existe, el actual.
        const name = item.product_name || product?.name || "Producto";
        const model = item.variant_name || variant?.model_name || "";

        return `
          <tr>
            <td style="padding:10px 0;">
              ${esc(name)}${model ? ` <span style="color:#6b7280;">(${esc(model)})</span>` : ""}
            </td>
            <td style="text-align:center;">${esc(item.quantity)}</td>
            <td style="text-align:right;">$${esc(item.price)} MXN</td>
          </tr>
        `;
      })
      .join("");

    const shortId = orderId.slice(0, 8);

    const { error: sendError } = await resend.emails.send({
      from: "Office Gama <ventas@officegama.com>",
      to: order.user_email,
      subject: `Tu pedido #${shortId} ha sido enviado 🚚`,
      html: `
        <div style="font-family: Arial, sans-serif; background:#f3f4f6; padding:40px;">
          <div style="max-width:600px; margin:auto; background:white; padding:30px; border-radius:12px; border:1px solid #e5e7eb;">

            <h2 style="color:#111827;">
              Hola ${esc(order.full_name)}, 👋
            </h2>

            <p style="color:#374151;">
              ¡Buenas noticias! Tu pedido ya fue enviado y está en camino.
            </p>

            <p>
              <strong>Pedido:</strong> #${esc(shortId)}<br/>
              <strong>Total:</strong> $${esc(order.total)} MXN
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
              ${esc(order.full_name)}<br/>
              ${esc(order.address)}<br/>
              ${esc(order.city)}<br/>
              CP: ${esc(order.postal_code)}<br/>
              Tel: ${esc(order.phone)}
            </p>

            <p style="margin-top:25px; font-size:14px; color:#6b7280;">
              Gracias por confiar en <strong>Office Gama</strong> 💙
            </p>

          </div>
        </div>
      `,
    });

    if (sendError) {
      console.error("Resend rechazó el correo:", sendError);
      return false;
    }

    console.log("Correo de envío enviado ✅");
    return true;
  } catch (err) {
    console.error("Error enviando correo:", err);
    return false;
  }
}


// Correo de "recibimos tu pedido". Devuelve true si se envió.
export async function sendOrderConfirmationEmail(orderId: string): Promise<boolean> {
  try {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error || !order || !order.user_email) {
      console.error("Confirmación: pedido sin correo o no encontrado:", orderId, error);
      return false;
    }

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("quantity, price, product_name, variant_name")
      .eq("order_id", orderId);

    const rows = (items || [])
      .map(
        (it: any) => `
          <tr>
            <td style="padding:10px 0;">
              ${esc(it.product_name || "Producto")}${
                it.variant_name
                  ? ` <span style="color:#6b7280;">(${esc(it.variant_name)})</span>`
                  : ""
              }
            </td>
            <td style="text-align:center;">${esc(it.quantity)}</td>
            <td style="text-align:right;">$${esc(it.price)} MXN</td>
          </tr>`
      )
      .join("");

    const shippingLabel =
      SHIPPING_OPTIONS[order.shipping_type as ShippingType]?.label ?? "Envío";
    const isPickup = order.shipping_type === "pickup";
    const shortId = orderId.slice(0, 8);

    const whereBlock = isPickup
      ? `<h3>📍 Recoge tu pedido en:</h3>
         <p style="line-height:1.6; color:#374151;">
           ${esc(STORE_ADDRESS_FULL)}<br/>
           <a href="${esc(STORE_MAPS_URL)}" style="color:#7c3aed;">Ver en Google Maps</a><br/>
           <span style="color:#6b7280;">Te avisaremos cuando esté listo.</span>
         </p>`
      : `<h3>📦 Dirección de envío:</h3>
         <p style="line-height:1.6; color:#374151;">
           ${esc(order.full_name)}<br/>
           ${esc(order.address)}<br/>
           ${esc(order.city)}<br/>
           CP: ${esc(order.postal_code)}<br/>
           Tel: ${esc(order.phone)}
         </p>`;

    const { error: sendError } = await resend.emails.send({
      from: "Office Gama <ventas@officegama.com>",
      to: order.user_email,
      subject: `Recibimos tu pedido #${shortId} ✅`,
      html: `
        <div style="font-family: Arial, sans-serif; background:#f3f4f6; padding:40px;">
          <div style="max-width:600px; margin:auto; background:white; padding:30px; border-radius:12px; border:1px solid #e5e7eb;">
            <h2 style="color:#111827;">¡Gracias por tu compra, ${esc(order.full_name)}! 💜</h2>
            <p style="color:#374151;">
              Recibimos tu pago y ya estamos preparando tu pedido.
            </p>
            <p>
              <strong>Pedido:</strong> #${esc(shortId)}<br/>
              <strong>Entrega:</strong> ${esc(shippingLabel)}<br/>
              <strong>Total pagado:</strong> $${esc(order.total)} MXN
            </p>
            <hr style="margin:25px 0;" />
            <h3>🛍 Tu pedido:</h3>
            <table width="100%" style="border-collapse:collapse; font-size:14px;">
              <thead>
                <tr style="border-bottom:1px solid #e5e7eb;">
                  <th align="left">Producto</th>
                  <th align="center">Cantidad</th>
                  <th align="right">Precio</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <hr style="margin:25px 0;" />
            ${whereBlock}
            <p style="margin-top:25px; font-size:14px; color:#6b7280;">
              Gracias por confiar en <strong>Office Gama</strong> 💙
            </p>
          </div>
        </div>
      `,
    });

    if (sendError) {
      console.error("Resend rechazó el correo de confirmación:", sendError);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error enviando correo de confirmación:", err);
    return false;
  }
}
