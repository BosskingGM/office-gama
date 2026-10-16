"use client";

// Captura de dirección con dos caminos:
//   • "Escribir dirección": código postal → aparecen las colonias de ese CP.
//   • "Marcar en el mapa": pin (o ubicación actual); al marcarlo se intenta
//     rellenar calle, CP y colonia, y el cliente puede corregirlos.
// Lo usan el carrito y /cuenta/direcciones, para que se comporten igual.

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, PenLine } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import { norm, type AddressMode, type PostalInfo } from "@/lib/address";
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
  /** Municipio que devolvió la consulta del CP (para validar entrega local). */
  cp_city: string | null;
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
  /** Si la zona es local y el CP no lo es, ofrece pasarse a paquetería. */
  onSwitchToParcel?: () => void;
};

type Lookup = "idle" | "loading" | "ok" | "notfound" | "error";

const clientCache = new Map<string, PostalInfo>();

function matchColonia(options: string[], wanted: string): string {
  const w = norm(wanted);
  if (w.length < 3) return "";
  const exact = options.find((o) => norm(o) === w);
  if (exact) return exact;
  return options.find((o) => {
    const n = norm(o);
    return n.length >= 4 && (n.includes(w) || w.includes(n));
  }) ?? "";
}

export default function AddressFields({
  value,
  onChange,
  zone,
  errors = {},
  idPrefix,
  onSwitchToParcel,
}: Props) {
  const local = zone === "local";
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [status, setStatus] = useState<Lookup>("idle");
  const [info, setInfo] = useState<PostalInfo | null>(null);
  const infoRef = useRef<PostalInfo | null>(null);

  // true cuando el CP lo cambió la persona (o el mapa): ahí sí se corrige la ciudad/colonia.
  const autofill = useRef(false);
  const pendingColonia = useRef(""); // colonia sugerida por el mapa
  const lastAutoStreet = useRef("");
  const geoCount = useRef(0);
  const [geoBusy, setGeoBusy] = useState(false);

  const pin: LatLng | null =
    value.latitude !== null && value.longitude !== null
      ? { lat: value.latitude, lng: value.longitude }
      : null;

  /* ---------- Colonias del código postal ---------- */
  const cp = value.postal_code;
  useEffect(() => {
    if (!/^\d{5}$/.test(cp)) {
      setStatus("idle");
      setInfo(null);
      infoRef.current = null;
      if (valueRef.current.cp_city) onChangeRef.current({ cp_city: null });
      return;
    }

    let alive = true;
    const apply = (data: PostalInfo) => {
      if (!alive) return;
      infoRef.current = data;
      setInfo(data);
      setStatus("ok");

      const v = valueRef.current;
      const patch: Partial<AddrValue> = { cp_city: data.municipio || null };

      if (data.municipio && (autofill.current || !v.city)) {
        patch.city = local ? matchLocalCity(data.municipio) ?? "" : data.municipio;
      }

      const current = data.colonias.find((c) => norm(c) === norm(v.colonia));
      if (current) {
        patch.colonia = current; // respeta mayúsculas oficiales
      } else if (pendingColonia.current && matchColonia(data.colonias, pendingColonia.current)) {
        patch.colonia = matchColonia(data.colonias, pendingColonia.current);
      } else if (data.colonias.length === 1) {
        patch.colonia = data.colonias[0];
      } else if (autofill.current) {
        patch.colonia = ""; // cambió el CP: la colonia anterior ya no aplica
      }
      pendingColonia.current = "";
      autofill.current = false;
      onChangeRef.current(patch);
    };

    const cached = clientCache.get(cp);
    if (cached) {
      apply(cached);
      return () => {
        alive = false;
      };
    }

    setStatus("loading");
    fetch(`/api/cp/${cp}`)
      .then(async (res) => {
        if (!alive) return;
        if (res.ok) {
          const data = (await res.json()) as PostalInfo;
          clientCache.set(cp, data);
          apply(data);
        } else {
          infoRef.current = null;
          setInfo(null);
          setStatus(res.status === 404 ? "notfound" : "error");
          autofill.current = false;
          if (valueRef.current.cp_city) onChangeRef.current({ cp_city: null });
        }
      })
      .catch(() => {
        if (!alive) return;
        infoRef.current = null;
        setInfo(null);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp]);

  /* ---------- Pin en el mapa → dirección aproximada ---------- */
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

      const v = valueRef.current;
      const patch: Partial<AddrValue> = {};

      if (street && (!v.address.trim() || v.address === lastAutoStreet.current)) {
        patch.address = street;
        lastAutoStreet.current = street;
      }
      if (postcode) {
        pendingColonia.current = suburb;
        autofill.current = true;
        if (postcode === v.postal_code && infoRef.current) {
          // Mismo CP: no se vuelve a consultar, se elige la colonia aquí.
          const m = matchColonia(infoRef.current.colonias, suburb);
          if (m) patch.colonia = m;
          pendingColonia.current = "";
          autofill.current = false;
        } else {
          patch.postal_code = postcode;
        }
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

  /* ---------- Avisos ---------- */
  const cpOutsideLocal =
    local && status === "ok" && info !== null && !!info.municipio && !matchLocalCity(info.municipio);
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

  const coloniaOptions = info?.colonias ?? [];
  const showColoniaSelect = status === "ok" && coloniaOptions.length > 0;

  return (
    <div className="sm:col-span-2 space-y-4">
      <div role="radiogroup" aria-label="Cómo capturar la dirección" className="flex gap-2">
        {modeBtn("manual", "Escribir dirección", <PenLine size={16} aria-hidden="true" />)}
        {modeBtn("mapa", "Marcar en el mapa", <MapPin size={16} aria-hidden="true" />)}
      </div>

      {value.mode === "mapa" && (
        <div className="space-y-2">
          <LocationPicker
            zone={zone}
            value={pin}
            onChange={handlePin}
            error={errors.location}
          />
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
            onChange={(e) => {
              autofill.current = true;
              onChange({ postal_code: e.target.value.replace(/\D/g, "") });
            }}
            aria-invalid={!!errors.postal_code}
            aria-describedby={errors.postal_code ? `${idPrefix}-err-postal_code` : undefined}
            className={fieldClass("postal_code")}
          />
          {status === "loading" && (
            <p className="text-xs text-muted mt-1.5 inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Buscando colonias…
            </p>
          )}
          {status === "notfound" && !errors.postal_code && (
            <p className="text-xs text-danger mt-1.5">
              No encontramos ese código postal. Revisa que esté bien escrito.
            </p>
          )}
          {status === "error" && (
            <p className="text-xs text-muted mt-1.5">
              No pudimos cargar las colonias ahora. Escribe la tuya en el campo de colonia.
            </p>
          )}
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

        {cpOutsideLocal && info && (
          <p
            role="alert"
            className="sm:col-span-2 text-sm text-neutral-700 bg-peach-soft border border-peach rounded-xl px-4 py-3"
          >
            Ese código postal es de <strong>{info.municipio}{info.estado ? `, ${info.estado}` : ""}</strong>.
            La entrega local es {LOCAL_COVERAGE_TEXT.toLowerCase()}.
            {onSwitchToParcel && (
              <>
                {" "}
                <button type="button" onClick={onSwitchToParcel} className="font-semibold underline">
                  Usar paquetería nacional
                </button>
                .
              </>
            )}
          </p>
        )}

        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-colonia`} className="text-sm font-medium mb-1.5 block">
            Colonia
          </label>
          {showColoniaSelect ? (
            <select
              id={`${idPrefix}-colonia`}
              value={coloniaOptions.find((c) => norm(c) === norm(value.colonia)) ?? ""}
              onChange={(e) => onChange({ colonia: e.target.value })}
              aria-invalid={!!errors.colonia}
              aria-describedby={errors.colonia ? `${idPrefix}-err-colonia` : undefined}
              className={fieldClass("colonia")}
            >
              <option value="">Elige tu colonia…</option>
              {coloniaOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : status === "idle" || status === "loading" ? (
            <select id={`${idPrefix}-colonia`} disabled className="field" value="">
              <option value="">
                {status === "loading" ? "Buscando colonias…" : "Primero escribe tu código postal"}
              </option>
            </select>
          ) : (
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
          )}
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
