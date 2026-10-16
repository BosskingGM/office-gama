import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";
import { STORE_ADDRESS_FULL } from "@/lib/store";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: `Aviso de privacidad de ${LEGAL.brand}: qué datos recabamos, para qué y cómo ejercer tus derechos.`,
};

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Aviso de privacidad"
      intro={`En cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su normativa aplicable, te informamos cómo tratamos tus datos personales cuando usas ${LEGAL.site}.`}
    >
      <Section title="1. Responsable de tus datos">
        <p>
          <strong>{LEGAL.owner}</strong>, persona física, con nombre comercial{" "}
          {LEGAL.brand}, y domicilio en {STORE_ADDRESS_FULL} es responsable del
          tratamiento de tus datos personales.
        </p>
        <p>
          Contacto para temas de privacidad: {LEGAL.email} · WhatsApp{" "}
          {LEGAL.whatsapp}.
        </p>
      </Section>

      <Section title="2. Datos personales que recabamos">
        <ul>
          <li>
            <strong>Identificación y contacto:</strong> nombre, correo
            electrónico y teléfono.
          </li>
          <li>
            <strong>Cuenta:</strong> correo y contraseña (la contraseña se
            guarda cifrada; la Tienda no la puede ver).
          </li>
          <li>
            <strong>Entrega:</strong> dirección, ciudad, código postal y, si lo
            indicas en el mapa, la ubicación (coordenadas) del punto de
            entrega.
          </li>
          <li>
            <strong>Compra:</strong> productos, importes, cupones usados,
            método de pago elegido, estado del pedido y, si pagas por
            transferencia, el comprobante que nos envíes.
          </li>
          <li>
            <strong>Pago con tarjeta:</strong> los datos de tarjeta los captura
            directamente Stripe; la Tienda no los recibe ni almacena.
          </li>
          <li>
            <strong>Datos técnicos:</strong> información básica del
            dispositivo y de la conexión necesaria para que el sitio funcione y
            sea seguro.
          </li>
        </ul>
        <p>
          <strong>No recabamos datos personales sensibles</strong> (como salud,
          origen étnico, religión o ideología). Te pedimos no enviarlos.
        </p>
      </Section>

      <Section title="3. Para qué usamos tus datos">
        <p>
          <strong>Finalidades necesarias</strong> (sin ellas no podemos darte el
          servicio):
        </p>
        <ul>
          <li>Crear y administrar tu cuenta y validar tu correo.</li>
          <li>Procesar, cobrar, preparar, entregar y dar seguimiento a tus pedidos.</li>
          <li>Enviarte avisos del pedido (confirmación, pago, envío, entrega).</li>
          <li>Atender aclaraciones, cambios, devoluciones, garantías y quejas.</li>
          <li>Prevenir fraudes y cumplir obligaciones legales.</li>
        </ul>
        <p>
          <strong>Finalidades secundarias</strong> (puedes negarte sin
          perder el servicio): enviarte por correo o WhatsApp promociones,
          cupones y novedades de la tienda. Si no quieres recibirlas, escríbenos
          a {LEGAL.email} o responde “BAJA” a nuestros mensajes, y dejaremos de
          usar tus datos para esos fines.
        </p>
      </Section>

      <Section title="4. Con quién compartimos tus datos">
        <p>
          No vendemos tus datos. Para operar la tienda los compartimos con
          proveedores que los tratan por nuestra cuenta, en lo estrictamente
          necesario:
        </p>
        <ul>
          <li>
            <strong>Supabase:</strong> almacenamiento de la base de datos y
            autenticación de cuentas.
          </li>
          <li>
            <strong>Stripe:</strong> procesamiento de pagos con tarjeta.
          </li>
          <li>
            <strong>Resend:</strong> envío de correos de verificación y de
            pedidos.
          </li>
          <li>
            <strong>Vercel:</strong> alojamiento del sitio web.
          </li>
          <li>
            <strong>OpenStreetMap / Nominatim:</strong> mapa y búsqueda de la
            dirección a partir del punto que marcas.
          </li>
          <li>
            <strong>Paqueterías o repartidores:</strong> tu nombre, teléfono y
            dirección para entregarte el pedido.
          </li>
          <li>
            <strong>WhatsApp (Meta):</strong> cuando nos escribes por ese
            medio, aplican también sus propias políticas.
          </li>
          <li>
            <strong>Autoridades:</strong> cuando una ley o una orden
            fundada nos lo exija.
          </li>
        </ul>
        <p>
          Algunos de estos proveedores pueden almacenar o procesar datos fuera
          de México. Al usar la tienda aceptas estas transferencias, que son
          necesarias para la relación contigo. No hacemos otras transferencias
          sin pedir tu consentimiento cuando la ley lo requiera.
        </p>
      </Section>

      <Section title="5. Tus derechos (ARCO y otros)">
        <p>
          Tienes derecho a <strong>acceder</strong> a tus datos,{" "}
          <strong>rectificarlos</strong> o actualizarlos,{" "}
          <strong>cancelarlos</strong> y <strong>oponerte</strong> a su uso, así
          como a <strong>revocar el consentimiento</strong> que nos diste y a
          limitar su uso o divulgación.
        </p>
        <p>
          Para ejercerlos, envía tu solicitud a <strong>{LEGAL.email}</strong>{" "}
          con: tu nombre completo y el correo de tu cuenta; una copia de una
          identificación oficial; la descripción clara del derecho que quieres
          ejercer y de los datos involucrados; y, para rectificar, los datos
          correctos. Te responderemos en un plazo máximo de 20 días hábiles
          y, si procede, haremos efectivo lo solicitado en los 15 días hábiles
          siguientes.
        </p>
        <p>
          Algunos datos (como los de tus pedidos) debemos conservarlos por
          obligaciones legales o para atender garantías; en esos casos te lo
          explicaremos. Puedes editar tu nombre, teléfono y direcciones
          directamente en <Link href="/cuenta">Mi cuenta</Link>.
        </p>
        <p>
          Si consideras que tu derecho no fue atendido, puedes acudir ante la
          autoridad de protección de datos personales competente (a partir de
          2025, la Secretaría Anticorrupción y Buen Gobierno).
        </p>
      </Section>

      <Section title="6. Conservación y seguridad">
        <p>
          Conservamos tus datos mientras tengas cuenta y el tiempo necesario
          para cumplir obligaciones legales, atender garantías o aclaraciones.
          Aplicamos medidas de seguridad administrativas, técnicas y físicas
          razonables (conexión cifrada, contraseñas cifradas, acceso
          restringido). Si ocurre una vulneración que afecte de forma
          significativa tus derechos, te lo informaremos.
        </p>
      </Section>

      <Section title="7. Almacenamiento en tu navegador">
        <p>
          La tienda guarda en tu navegador (almacenamiento local) tu carrito,
          los datos del formulario de compra para que no tengas que escribirlos
          otra vez y preferencias como la forma de ver el catálogo. No usamos
          cookies de publicidad ni herramientas de análisis de terceros. Puedes
          borrar esos datos desde la configuración de tu navegador.
        </p>
      </Section>

      <Section title="8. Menores de edad">
        <p>
          El sitio no está dirigido a menores sin supervisión. Si eres madre,
          padre o tutor y crees que un menor nos dio datos sin tu autorización,
          escríbenos y los eliminaremos.
        </p>
      </Section>

      <Section title="9. Cambios a este aviso">
        <p>
          Podemos modificar este aviso por cambios legales o en nuestro
          servicio. Publicaremos la versión vigente en esta página, con su
          fecha de actualización, y te avisaremos por el sitio o por correo si
          el cambio es importante.
        </p>
        <p>
          Consulta también los <Link href="/terminos">Términos y condiciones</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
