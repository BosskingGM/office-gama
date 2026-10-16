import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";
import { STORE_ADDRESS_FULL } from "@/lib/store";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: `Términos y condiciones de compra y uso de ${LEGAL.brand}.`,
};

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      intro={`Estos Términos y Condiciones regulan el uso del sitio ${LEGAL.site} y las compras que realices en él. Al navegar, crear una cuenta o hacer un pedido, confirmas que los leíste y los aceptas. Si no estás de acuerdo, te pedimos no usar el sitio.`}
    >
      <Section title="1. Quiénes somos">
        <p>
          {LEGAL.brand} es una tienda de papelería importada operada por{" "}
          <strong>{LEGAL.owner}</strong>, persona física (en adelante, “la
          Tienda”).
        </p>
        <ul>
          <li>Domicilio: {STORE_ADDRESS_FULL}</li>
          <li>Correo: {LEGAL.email}</li>
          <li>WhatsApp: {LEGAL.whatsapp}</li>
        </ul>
      </Section>

      <Section title="2. Uso del sitio y tu cuenta">
        <p>
          Para comprar debes tener una cuenta con datos verdaderos y actuales.
          Eres responsable de la confidencialidad de tu contraseña y de lo que
          ocurra con tu cuenta. Debes ser mayor de edad (o contar con la
          autorización de tu madre, padre o tutor) para comprar. Nos reservamos
          el derecho de suspender cuentas que den un uso fraudulento o
          contrario a estos Términos.
        </p>
      </Section>

      <Section title="3. Productos, precios y disponibilidad">
        <ul>
          <li>
            Los precios están en pesos mexicanos (MXN) e incluyen IVA cuando
            aplica. El costo de envío se muestra en el carrito antes de pagar.
          </li>
          <li>
            Las fotografías son ilustrativas; los colores pueden variar
            ligeramente según tu pantalla y el diseño de cada lote.
          </li>
          <li>
            Las existencias son limitadas. Si por un error de captura o de
            inventario un producto no está disponible o el precio publicado es
            evidentemente erróneo, te lo avisaremos y podrás elegir otro
            producto, esperar la reposición o recibir el reembolso total de lo
            que hayas pagado por él.
          </li>
          <li>
            Los precios y promociones pueden cambiar sin previo aviso, pero no
            afectan a pedidos ya confirmados.
          </li>
        </ul>
      </Section>

      <Section title="4. Cómo comprar y formas de pago">
        <p>Al enviar tu pedido haces una oferta de compra que se confirma cuando recibes nuestro aviso de pedido o de pago registrado. Aceptamos:</p>
        <ul>
          <li>
            <strong>Tarjeta de crédito o débito</strong> (Visa y Mastercard),
            procesada por Stripe. La Tienda no almacena ni ve los datos
            completos de tu tarjeta.
          </li>
          <li>
            <strong>Transferencia bancaria</strong>. Debes enviar tu
            comprobante por WhatsApp; el pedido se prepara cuando el pago se
            vea reflejado.
          </li>
          <li>
            <strong>Pago al recoger en tienda</strong>, solo con la opción
            “Recoger en tienda”. Apartamos tus piezas por el tiempo que se te
            indique al confirmar; si no se recogen en ese plazo, el pedido
            podrá cancelarse.
          </li>
        </ul>
        <p>
          Los cupones de descuento son personales, no acumulables salvo que se
          indique lo contrario, no se canjean por dinero y se aplican solo
          sobre el precio de los productos (no sobre el envío). Pueden tener
          condiciones, como ser válidos solo en la primera compra o a partir
          de un monto mínimo, que se te informan en la promoción.
        </p>
      </Section>

      <Section title="5. Entrega">
        <p>Puedes elegir entre:</p>
        <ul>
          <li>
            <strong>Recoger en tienda</strong>, sin costo, en el domicilio
            indicado arriba. Te avisaremos cuando tu pedido esté listo.
          </li>
          <li>
            <strong>Entrega local</strong>, disponible solo en Chalco e
            Ixtapaluca. Debes indicar tu dirección y ubicación correctas.
          </li>
          <li>
            <strong>Paquetería nacional</strong> a todo México, con el costo
            mostrado en el carrito. Te compartiremos tu guía de rastreo cuando
            el pedido salga.
          </li>
        </ul>
        <p>
          Los tiempos de entrega son estimados y pueden variar por la
          paquetería, la zona o causas de fuerza mayor. Eres responsable de
          capturar una dirección completa y correcta; si el paquete se
          devuelve por datos erróneos o por no ser recibido, el nuevo envío
          podrá generar un costo adicional. El riesgo de pérdida o daño pasa a
          ti cuando recibes el paquete; si notas daños visibles al recibirlo,
          te recomendamos anotarlo y avisarnos de inmediato.
        </p>
      </Section>

      <Section title="6. Cambios, devoluciones y reembolsos">
        <p>
          <strong>Producto defectuoso, dañado o distinto al pedido.</strong>{" "}
          Tienes {LEGAL.returnDays} días naturales contados desde que recibes
          tu pedido para reportarlo por WhatsApp o correo, con tu número de
          pedido y fotografías o video del producto y su empaque. Si procede,
          elegirás entre un cambio por el mismo producto, otro producto de
          valor similar o el reembolso del precio pagado, y la Tienda cubre el
          costo del envío de la reposición.
        </p>
        <p>Para que proceda, el producto debe estar sin uso (salvo el necesario para detectar el defecto), con sus accesorios y, de ser posible, en su empaque original.</p>
        <p>
          <strong>No aplican cambios ni devoluciones</strong> por simple
          arrepentimiento, uso o desgaste normal, daños causados después de la
          entrega, ni en productos de liquidación, higiene o personalizados,
          salvo que presenten defectos.
        </p>
        <p>
          <strong>Derecho de revocación.</strong> Lo anterior no limita los
          derechos que la Ley Federal de Protección al Consumidor te da en
          compras realizadas a distancia, como el derecho a revocar tu
          consentimiento dentro de los 5 días hábiles posteriores a recibir el
          producto, sin responsabilidad para ti, avisándonos por un medio
          comprobable (correo o WhatsApp). En ese caso devolvemos el precio
          pagado y los costos de flete y seguro de la devolución corren por tu
          cuenta. El producto debe devolverse en las mismas condiciones en que
          lo recibiste.
        </p>
        <p>
          Los reembolsos se hacen por el mismo medio de pago (o por
          transferencia, si pagaste así) dentro de un plazo razonable, que
          puede tardar algunos días hábiles según tu banco.
        </p>
      </Section>

      <Section title="7. Cancelación de pedidos">
        <p>
          Puedes pedir la cancelación escribiéndonos por WhatsApp mientras tu
          pedido no haya sido enviado. Si ya fue pagado, se reembolsa. La
          Tienda puede cancelar un pedido por falta de existencias, error de
          precio, datos incompletos, sospecha de fraude o falta de pago, y en
          ese caso reembolsará lo que hayas pagado.
        </p>
      </Section>

      <Section title="8. Garantía">
        <p>
          Los productos cuentan con la garantía legal contra defectos y vicios
          ocultos que establece la Ley Federal de Protección al Consumidor.
          Para hacerla valer, contáctanos con tu número de pedido.
        </p>
      </Section>

      <Section title="9. Facturación">
        <p>
          Por el momento la Tienda <strong>no emite facturas (CFDI)</strong>.
          Tu comprobante de compra es el correo de confirmación y el número de
          pedido, que puedes consultar en tu cuenta en “Mis pedidos”.
        </p>
      </Section>

      <Section title="10. Propiedad intelectual">
        <p>
          El nombre, logotipo, mascota, diseños, textos e imágenes de{" "}
          {LEGAL.brand} son de su titular y están protegidos por la ley. No
          puedes copiarlos, modificarlos ni usarlos con fines comerciales sin
          autorización por escrito. Las marcas y diseños de los productos
          pertenecen a sus respectivos dueños.
        </p>
      </Section>

      <Section title="11. Límite de responsabilidad">
        <p>
          Hacemos lo posible por mantener el sitio disponible y sin errores,
          pero no garantizamos que funcione sin interrupciones. En la medida
          que permita la ley, la Tienda no responde por daños indirectos
          derivados del uso del sitio, por fallas de servicios de terceros
          (internet, banco, paquetería) ni por casos fortuitos o fuerza mayor.
          Nada de esto limita los derechos que la ley te reconoce como
          consumidor.
        </p>
      </Section>

      <Section title="12. Privacidad">
        <p>
          El tratamiento de tus datos personales se rige por nuestro{" "}
          <Link href="/privacidad">Aviso de Privacidad</Link>.
        </p>
      </Section>

      <Section title="13. Cambios a estos Términos">
        <p>
          Podemos actualizar estos Términos. La versión vigente es la publicada
          en esta página, con su fecha de actualización. Los cambios no
          afectan a pedidos ya realizados.
        </p>
      </Section>

      <Section title="14. Ley aplicable, quejas y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de los Estados Unidos
          Mexicanos. Si tienes una queja, escríbenos primero a {LEGAL.email} o
          por WhatsApp para resolverla. También puedes acudir a la Procuraduría
          Federal del Consumidor (PROFECO). Para cualquier controversia, las
          partes se someten a los tribunales competentes de Chalco, Estado de
          México, sin perjuicio del derecho del consumidor a acudir ante la
          PROFECO o ante la autoridad que le corresponda por ley.
        </p>
      </Section>

      <Section title="15. Contacto">
        <p>
          {LEGAL.email} · WhatsApp {LEGAL.whatsapp}
        </p>
      </Section>
    </LegalPage>
  );
}
