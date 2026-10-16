"use client";

// Captura de dirección con dos caminos:
//   • "Escribir dirección": CP, colonia, municipio y calle, todo a mano.
//   • "Marcar en el mapa": pin (o ubicación actual); al marcarlo se intenta
//     rellenar calle, CP y colonia, y el cliente puede corregirlos.
// Lo usan el carrito y /cuenta/direcciones, para que se comporten igual.

import { useRef, useState } from "react";
import { Loader2, MapPin, PenLine } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import type { AddressMode } from "@/lib/address";
import {
  LOCAL_CITIES,
  LOCAL_COVERAGE_TEXT,
  isInsideLocalZone,
  matchLocalCity,
  type LatLng,
} from "@/lib/shipping";

export type AddrValue = {
  address: string; // calle y número (la colonia va aparte)
  colonia: string;
  city: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  mode: AddressMode;
};

export type AddrErrors = Partial<
  Record<"address" | "colonia" | "city" | "postal_code" | "location", string>
>;

type Props = {
  value: AddrValue;
  onChange: (patch: Partial<AddrValue>) => void;
  /** "local": solo Chalco/Ixtapaluca · "mexico": cualquier lugar de México. */
  zone: "local" | "mexico";
  errors?: AddrErrors;
  idPrefix: string;
  /** Si la zona es local, ofrece pasarse a paquetería. */
  onSwitchToParcel?: () => void;
};

export default function AddressFields({
  value,
  onChange,
  zone,
  errors = {},
  idPrefix,
}: Props) {
  const local = zone === "local";
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const lastAutoStreet = useRef("");
  const geoCount = useRef(0);
  const [geoBusy, setGeoBusy] = useState(false);

  const pin: LatLng | null =
    value.latitude !== null && value.longitude !== null
      ? { lat: value.latitude, lng: value.longitude }
      : null;

  /* Pin en el mapa → dirección aproximada (OpenStreetMap). Siempre editable. */
  const handlePin = async (p: LatLng | null) => {
    onChange({ latitude: p ? p.lat : null, longitude: p ? p.lng : null });
    if (!p) return;

    const id = ++geoCount.current;
    setGeoBusy(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=es&lat=${p.lat}&lon=${p.lng}`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok || id !== geoCount.current) return;
      const a = (await res.json())?.address ?? {};

      const postcode =
        typeof a.postcode === "string" && /^\d{5}$/.test(a.postcode) ? a.postcode : "";
      const road = a.road ?? a.pedestrian ?? a.footway ?? "";
      const street = [road, a.house_number].filter(Boolean).join(" ");
      const suburb = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? "";
      const muni = a.city ?? a.town ?? a.municipality ?? a.village ?? "";

      const v = valueRef.current;
      const patch: Partial<AddrValue> = {};
      if (street && (!v.address.trim() || v.address === lastAutoStreet.current)) {
        patch.address = street;
        lastAutoStreet.current = street;
      }
      if (postcode) patch.postal_code = postcode;
      if (suburb) patch.colonia = suburb;
      if (muni) {
        const m = local ? matchLocalCity(muni) : muni;
        if (m) patch.city = m;
      }
      if (Object.keys(patch).length) onChangeRef.current(patch);
    } catch {
      /* sin red o bloqueado: la persona llena los campos a mano */
    } finally {
      if (id === geoCount.current) setGeoBusy(false);
    }
  };

  const setMode = (mode: AddressMode) => {
    if (mode === value.mode) return;
    geoCount.current++;
    setGeoBusy(false);
    // En modo escrito no se conserva un pin viejo que pueda contradecir la dirección.
    onChange(
      mode === "manual" ? { mode, latitude: null, longitude: null } : { mode }
    );
  };

  const pinOutside = local && pin !== null && !isInsideLocalZone(pin);

  const fieldClass = (k: keyof AddrErrors) =>
    `field ${errors[k] ? "border-danger!" : ""}`;
  const Err = ({ k }: { k: keyof AddrErrors }) =>
    errors[k] ? (
      <p id={`${idPrefix}-err-${k}`} role="alert" className="text-xs text-danger mt-1.5">
        {errors[k]}
      </p>
    ) : null;

  const modeBtn = (m: AddressMode, label: string, icon: React.ReactNode) => (
    <button
      key={m}
      type="button"
      role="radio"
      aria-checked={value.mode === m}
      onClick={() => setMode(m)}
      className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold border-2 transition ${
        value.mode === m
          ? "border-brand-strong bg-brand-soft"
          : "border-line bg-white hover:border-brand"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="sm:col-span-2 space-y-4">
      <div role="radiogroup" aria-label="Cómo capturar la dirección" className="flex gap-2">
        {modeBtn("manual", "Escribir dirección", <PenLine size={16} aria-hidden="true" />)}
        {modeBtn("mapa", "Marcar en el mapa", <MapPin size={16} aria-hidden="true" />)}
      </div>

      {value.mode === "mapa" && (
        <div className="space-y-2">
          <LocationPicker zone={zone} value={pin} onChange={handlePin} error={errors.location} />
          {geoBusy && (
            <p className="text-xs text-muted inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Buscando la dirección de ese punto…
            </p>
          )}
          {pinOutside && (
            <p role="alert" className="text-xs text-danger">
              Ese punto está fuera de la zona de entrega local ({LOCAL_COVERAGE_TEXT.toLowerCase()}).
            </p>
          )}
          {pin && !geoBusy && (
            <p className="text-xs text-muted">
              Revisa y corrige los datos de abajo si hace falta.
            </p>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-cp`} className="text-sm font-medium mb-1.5 block">
            Código postal
          </label>
          <input
            id={`${idPrefix}-cp`}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="5 dígitos"
            value={value.postal_code}
            onChange={(e) => onChange({ postal_code: e.target.value.replace(/\D/g, "") })}
            aria-invalid={!!errors.postal_code}
            aria-describedby={errors.postal_code ? `${idPrefix}-err-postal_code` : undefined}
            className={fieldClass("postal_code")}
          />
          <Err k="postal_code" />
        </div>

        <div>
          <label htmlFor={`${idPrefix}-city`} className="text-sm font-medium mb-1.5 block">
            {local ? "Municipio" : "Ciudad o municipio"}
          </label>
          {local ? (
            <select
              id={`${idPrefix}-city`}
              value={matchLocalCity(value.city) ?? ""}
              onChange={(e) => onChange({ city: e.target.value })}
              aria-invalid={!!errors.city}
              aria-describedby={errors.city ? `${idPrefix}-err-city` : undefined}
              className={fieldClass("city")}
            >
              <option value="">Elige tu municipio…</option>
              {LOCAL_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${idPrefix}-city`}
              autoComplete="address-level2"
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value })}
              aria-invalid={!!errors.city}
              aria-describedby={errors.city ? `${idPrefix}-err-city` : undefined}
              className={fieldClass("city")}
            />
          )}
          <Err k="city" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-colonia`} className="text-sm font-medium mb-1.5 block">
            Colonia
          </label>
          <input
            id={`${idPrefix}-colonia`}
            value={value.colonia}
            onChange={(e) => onChange({ colonia: e.target.value })}
            placeholder="Nombre de tu colonia"
            maxLength={100}
            aria-invalid={!!errors.colonia}
            aria-describedby={errors.colonia ? `${idPrefix}-err-colonia` : undefined}
            className={fieldClass("colonia")}
          />
          <Err k="colonia" />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-street`} className="text-sm font-medium mb-1.5 block">
            Calle y número
          </label>
          <input
            id={`${idPrefix}-street`}
            autoComplete="address-line1"
            placeholder="Ej. Av. Juárez 25, entre calle X y Y"
            maxLength={250}
            value={value.address}
            onChange={(e) => onChange({ address: e.target.value })}
            aria-invalid={!!errors.address}
            aria-describedby={errors.address ? `${idPrefix}-err-address` : undefined}
            className={fieldClass("address")}
          />
          <Err k="address" />
        </div>
      </div>
    </div>
  );
}
