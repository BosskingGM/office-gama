"use client";

import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CarritoPage() {
  const {
    cart,
    removeFromCart,
    clearCart,
    increaseQuantity,
    decreaseQuantity,
  } = useCart();

  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [shippingType, setShippingType] = useState("pickup");

  const [message, setMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const productsTotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const shippingCost =
    shippingType === "pickup"
      ? 0
      : shippingType === "local"
      ? 50
      : 160;

  const finalTotal = productsTotal + shippingCost;

  const handleCheckout = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!fullName || !phone || !address || !city || !postalCode) {
      showMessage("Completa todos los datos de envío");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          user, // 🔥 ahora mandamos el objeto completo
          shipping: {
            shipping_type: shippingType,
            shipping_cost: shippingCost,
          },
          customer: {
            full_name: fullName,
            phone,
            address,
            city,
            postal_code: postalCode,
          },
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        showMessage("Error al crear sesión de pago");
      }
    } catch (error) {
      console.error(error);
      showMessage("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#faf9ff] flex items-center justify-center px-4">
        <div className="bg-white border border-neutral-200 p-10 rounded-3xl text-center space-y-6 max-w-md w-full">
          <h1 className="text-2xl font-bold text-neutral-900">
            Tu carrito está vacío
          </h1>
          <button
            onClick={() => router.push("/")}
            className="bg-[#d6a8ff] text-black px-8 py-3 rounded-2xl font-semibold hover:opacity-90 transition"
          >
            Ir a la tienda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9ff] relative">

      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl font-semibold z-50">
          {message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-neutral-900 mb-12">
          Carrito
        </h1>

        <div className="space-y-6">
          {cart.map((item) => (
            <div
              key={item.variant_id}
              className="bg-white border border-neutral-200 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center gap-6"
            >
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-neutral-200 bg-white shrink-0">
                <img
                  src={item.image_url || "/placeholder.png"}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-lg font-semibold text-neutral-900">
                  {item.name}
                </p>
                <p className="text-neutral-600 text-sm">
                  Modelo: {item.model_name}
                </p>
                <p className="text-lg font-semibold text-neutral-900">
                  ${item.price} MXN
                </p>

                <div className="flex items-center gap-4 pt-2">
                  <button
                    onClick={() => decreaseQuantity(item.variant_id)}
                    className="w-10 h-10 rounded-xl border border-neutral-300"
                  >
                    −
                  </button>

                  <span className="text-lg font-semibold text-neutral-900">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => increaseQuantity(item.variant_id)}
                    className="w-10 h-10 rounded-xl border border-neutral-300"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={() => removeFromCart(item.variant_id)}
                className="text-sm text-neutral-500 hover:text-red-600 transition"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-16">

          <div className="bg-white border border-neutral-200 p-8 rounded-3xl">
            <h2 className="text-2xl font-bold text-neutral-900 mb-8">
              Información de envío
            </h2>

            <div className="space-y-6">
              {[ 
                { value: fullName, set: setFullName, placeholder: "Nombre completo" },
                { value: phone, set: setPhone, placeholder: "Teléfono" },
                { value: address, set: setAddress, placeholder: "Dirección" },
                { value: city, set: setCity, placeholder: "Ciudad" },
                { value: postalCode, set: setPostalCode, placeholder: "Código postal" }
              ].map((field, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  className="w-full border border-neutral-300 px-5 py-3 rounded-2xl"
                />
              ))}

              <select
                value={shippingType}
                onChange={(e) => setShippingType(e.target.value)}
                className="w-full border border-neutral-300 px-5 py-3 rounded-2xl"
              >
                <option value="pickup">Recoger en tienda (Gratis)</option>
                <option value="local">Entrega local ($50)</option>
                <option value="paqueteria">
                  Paquetería nacional ($160)
                </option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 p-8 rounded-3xl h-fit">
            <h2 className="text-2xl font-bold text-neutral-900 mb-8">
              Resumen
            </h2>

            <div className="space-y-3 text-neutral-700">
              <p>Productos: ${productsTotal} MXN</p>
              <p>Envío: ${shippingCost} MXN</p>
            </div>

            <h3 className="text-3xl font-bold text-neutral-900 mt-8">
              Total: ${finalTotal} MXN
            </h3>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="mt-10 bg-[#d6a8ff] text-black font-semibold px-6 py-4 rounded-2xl w-full disabled:opacity-50"
            >
              {loading ? "Procesando..." : "Pagar con tarjeta"}
            </button>

            <button
              onClick={clearCart}
              className="mt-4 border border-neutral-300 text-neutral-700 px-6 py-4 rounded-2xl w-full"
            >
              Vaciar carrito
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}