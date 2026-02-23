"use client";

import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function CarritoPage() {
  const {
    cart,
    removeFromCart,
    clearCart,
    increaseQuantity,
    decreaseQuantity,
  } = useCart();

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [shippingType, setShippingType] = useState("local");

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

  const shippingCost = shippingType === "local" ? 50 : 120;
  const finalTotal = productsTotal + shippingCost;

  const handleCheckout = async () => {
    if (!user) {
      alert("Debes iniciar sesión para pagar");
      return;
    }

    if (!fullName || !phone || !address || !city || !postalCode) {
      alert("Completa todos los datos de envío");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          user_id: user.id,
          shipping: {
            full_name: fullName,
            phone,
            address,
            city,
            postal_code: postalCode,
            shipping_type: shippingType,
            shipping_cost: shippingCost,
          },
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Error creando sesión de pago");
      }
    } catch (error) {
      console.error(error);
      alert("Error iniciando pago");
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-md text-center space-y-4 max-w-md w-full">
          <h1 className="text-2xl font-bold text-black">
            Tu carrito está vacío
          </h1>
          <a
            href="/"
            className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-xl inline-block transition"
          >
            Ir a la tienda
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <h1 className="text-3xl sm:text-4xl font-bold text-black mb-10">
          🛒 Carrito
        </h1>

        {/* PRODUCTOS */}
        <div className="space-y-6">
          {cart.map((item) => (
            <div
              key={item.variant_id}
              className="
                bg-white 
                p-5 
                sm:p-6 
                rounded-2xl 
                shadow-sm 
                flex 
                flex-col 
                sm:flex-row 
                sm:justify-between 
                sm:items-center 
                gap-6
              "
            >
              {/* Info */}
              <div className="flex-1">
                <p className="text-lg sm:text-xl font-semibold text-black">
                  {item.name}
                </p>
                <p className="text-gray-600">
                  Modelo: {item.model_name}
                </p>
                <p className="text-pink-600 font-bold text-lg mt-1">
                  ${item.price} MXN
                </p>

                {/* Cantidad */}
                <div className="flex items-center gap-4 mt-4">
                  <button
                    onClick={() => decreaseQuantity(item.variant_id)}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-pink-500 text-white font-bold hover:bg-pink-600 transition"
                  >
                    -
                  </button>

                  <span className="text-lg font-bold text-black">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => increaseQuantity(item.variant_id)}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-pink-500 text-white font-bold hover:bg-pink-600 transition"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Botón eliminar */}
              <div className="sm:text-right">
                <button
                  onClick={() => removeFromCart(item.variant_id)}
                  className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg transition w-full sm:w-auto"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-14">

          {/* FORMULARIO */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm">
            <h2 className="text-2xl font-bold text-black mb-6">
              📦 Información de envío
            </h2>

            <div className="space-y-5">
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
                  className="w-full border border-gray-300 px-4 py-3 rounded-xl text-black focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              ))}

              <select
                value={shippingType}
                onChange={(e) => setShippingType(e.target.value)}
                className="w-full border border-gray-300 px-4 py-3 rounded-xl text-black focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="local">Entrega local ($50)</option>
                <option value="paqueteria">
                  Paquetería nacional ($120)
                </option>
              </select>
            </div>
          </div>

          {/* RESUMEN */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm h-fit">
            <h2 className="text-2xl font-bold text-black mb-6">
              🧾 Resumen
            </h2>

            <div className="space-y-3 text-black">
              <p>Productos: ${productsTotal} MXN</p>
              <p>Envío: ${shippingCost} MXN</p>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-black mt-6">
              Total: ${finalTotal} MXN
            </h3>

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="mt-8 bg-pink-500 hover:bg-pink-600 text-white font-semibold px-6 py-3 rounded-xl w-full transition disabled:bg-gray-400"
            >
              {loading ? "Procesando..." : "Pagar con tarjeta"}
            </button>

            <button
              onClick={clearCart}
              className="mt-4 bg-gray-200 hover:bg-gray-300 text-black px-6 py-3 rounded-xl w-full transition"
            >
              Vaciar carrito
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}