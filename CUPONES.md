# Cupones — cómo activarlos y usarlos

## Activar (una sola vez, en este orden)

1. **Supabase → SQL Editor → New query**: pega y corre `supabase/coupons.sql`
   (se puede correr más de una vez sin problema).
2. **Stripe → Developers → Webhooks → tu endpoint**: agrega el evento
   `checkout.session.expired` (ya tienes `checkout.session.completed`).
   Sirve para liberar el cupón si alguien abandona el pago de tarjeta. Si no lo
   agregas, el cupón se libera solo a los 40 minutos.
3. Sube el código y listo. Aparece **Cupones** en el menú de administración.

## Uso diario

1. **Admin → Cupones → Nuevo**. Elige:
   - **Descuento %** — cualquier cliente, una vez cada uno.
   - **Primera compra** — solo clientes sin pedidos anteriores.
   (Opcional: compra mínima, límite total de usos, vigencia.)
2. **Admin → Promociones → Nueva**: en "Al tocarla lleva a" elige
   **Obtener cupón (WhatsApp)** y escoge el cupón. El botón dice "Obtener cupón"
   y abre tu WhatsApp con el mensaje "Quiero mi cupón…". El código **no** se
   muestra en la tienda.
3. Cuando te escriban, en **Cupones → Copiar mensaje de WhatsApp** y lo pegas
   como respuesta (ya trae el código y las instrucciones).
4. El cliente escribe el código en el carrito ("¿Tienes un cupón?") antes de pagar.

## Reglas (las aplica la base de datos, no el navegador)

- Un cupón se usa **una sola vez por cliente**: por cuenta **y** por teléfono
  (los últimos 10 dígitos), así no sirve crear otra cuenta con el mismo teléfono.
- **Un cupón por pedido.**
- **Primera compra** = sin pedidos previos (los cancelados no cuentan), ni con su
  cuenta ni con su teléfono. Tampoco se pueden acumular dos cupones de primera compra.
- Si dos personas intentan gastar el último uso al mismo tiempo, solo una lo logra.
- El descuento se calcula en el servidor con los precios reales y **solo sobre productos**
  (no sobre el envío). Máximo 90 %.
- Los pagos con tarjeta **reservan** el cupón al iniciar el pago y lo marcan como usado
  cuando Stripe confirma. Si el pago se abandona o vence, se libera.
- Un cupón que ya se usó **no se puede borrar**, solo pausar (así nadie lo reutiliza
  recreando el mismo código).
- Para que alguien no pueda adivinar códigos, cada cuenta tiene 10 intentos cada 10 minutos.

## Dónde se ve el descuento

- Carrito, página del pedido, pantalla de pago confirmado y correos: línea "Descuento (cupón)".
- Admin → Pedidos: en las notas del pedido aparece `Cupón CODIGO: -$XX`.
