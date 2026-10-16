"use client";

// Mapa para que el cliente marque el punto exacto de entrega.
// Usa Leaflet + OpenStreetMap (gratis, sin llave de API).
// Toca el mapa o arrastra el pin; también puede usar su ubicación actual.

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin, X } from "lucide-react";
import {
  LOCAL_MAP_CENTER,
  LOCAL_ZONE,
  type LatLng,
} from "@/lib/shipping";

type Props = {
  value: LatLng | null;
  onChange: (p: LatLng | null) => void;
  /** "local" dibuja la zona de cobertura y centra el mapa ahí. */
  zone: "local" | "mexico";
  error?: string;
};

const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
  <path d="M17 43C17 43 32 27.5 32 16.5C32 8 25.3 1.5 17 1.5C8.7 1.5 2 8 2 16.5C2 27.5 17 43 17 43Z"
        fill="#7c3aed" stroke="#fff" stroke-width="2.5"/>
  <circle cx="17" cy="16.5" r="6" fill="#fff"/>
</svg>`;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export default function LocationPicker({ value, onChange, zone, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const [ready, setReady] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");
  const [locating, setLocating] = useState(false);

  /* Crear el mapa una sola vez */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const start = valueRef.current ?? (zone === "local" ? LOCAL_MAP_CENTER : { lat: 23.6, lng: -102.5 });
      const map = L.map(containerRef.current, {
        center: [start.lat, start.lng],
        zoom: valueRef.current ? 17 : zone === "local" ? 12 : 5,
        scrollWheelZoom: false, // evita "atrapar" el scroll de la página
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(map);

      if (zone === "local") {
        L.rectangle(
          [
            [LOCAL_ZONE.south, LOCAL_ZONE.west],
            [LOCAL_ZONE.north, LOCAL_ZONE.east],
          ],
          { color: "#7c3aed", weight: 2, dashArray: "6 6", fillOpacity: 0.05, interactive: false }
        ).addTo(map);
      }

      const icon = L.divIcon({
        html: PIN_SVG,
        className: "",
        iconSize: [34, 44],
        iconAnchor: [17, 43],
      });

      const place = (lat: number, lng: number) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const m = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
          m.on("dragend", () => {
            const p = m.getLatLng();
            onChangeRef.current({ lat: round6(p.lat), lng: round6(p.lng) });
          });
          markerRef.current = m;
        }
      };

      map.on("click", (e) => {
        place(e.latlng.lat, e.latlng.lng);
        onChangeRef.current({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) });
      });

      // Pin inicial (por ejemplo, el que quedó guardado en el navegador)
      if (valueRef.current) place(valueRef.current.lat, valueRef.current.lng);

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Mantener el pin sincronizado si el valor cambia desde fuera */
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      const cur = markerRef.current.getLatLng();
      if (cur.lat !== value.lat || cur.lng !== value.lng) {
        markerRef.current.setLatLng([value.lat, value.lng]);
      }
    } else {
      const icon = L.divIcon({
        html: PIN_SVG,
        className: "",
        iconSize: [34, 44],
        iconAnchor: [17, 43],
      });
      const m = L.marker([value.lat, value.lng], { icon, draggable: true }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        onChangeRef.current({ lat: round6(p.lat), lng: round6(p.lng) });
      });
      markerRef.current = m;
    }
  }, [value, ready]);

  const useMyLocation = () => {
    setGeoMsg("");
    if (!navigator.geolocation) {
      setGeoMsg("Tu navegador no permite obtener la ubicación. Toca el mapa para marcarla.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: round6(pos.coords.latitude), lng: round6(pos.coords.longitude) };
        onChangeRef.current(p);
        mapRef.current?.setView([p.lat, p.lng], 17);
        setLocating(false);
      },
      () => {
        setGeoMsg("No pudimos obtener tu ubicación. Toca el mapa para marcarla.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <MapPin size={16} className="text-brand-strong" aria-hidden="true" />
          Marca el punto de entrega en el mapa
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-line rounded-full px-3 py-1.5 hover:bg-brand-soft transition disabled:opacity-50"
          >
            <Crosshair size={14} aria-hidden="true" />
            {locating ? "Buscando…" : "Usar mi ubicación"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 border border-line rounded-full px-3 py-1.5 hover:bg-brand-soft transition"
            >
              <X size={14} aria-hidden="true" />
              Quitar pin
            </button>
          )}
        </div>
      </div>

      {/* isolate: mantiene los z-index internos de Leaflet dentro del mapa,
          para que no tapen el menú ni el carrito lateral */}
      <div
        className={`isolate rounded-2xl overflow-hidden border-2 ${
          error ? "border-danger" : "border-line"
        }`}
      >
        <div
          ref={containerRef}
          role="application"
          aria-label="Mapa para marcar el punto de entrega"
          className="h-72 w-full bg-brand-soft"
        />
      </div>

      <p className="text-xs text-muted leading-4">
        {value
          ? "Puedes arrastrar el pin para ajustarlo. "
          : "Toca el mapa para colocar el pin. "}
        {zone === "local" && "El área punteada es nuestra zona de entrega local."}
      </p>

      {geoMsg && <p className="text-xs text-neutral-600">{geoMsg}</p>}
      {error && (
        <p id="err-location" role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
