"use client";

import { diferido } from "@/components/diferido";

/** Piezas del sitio público cuyo código se pide después de la carga (ver diferido.tsx). */
export const ToroFlotanteDiferido = diferido(() => import("@/components/toro-flotante").then((m) => m.ToroFlotante));
export const MedicionConsentDiferido = diferido(() => import("@/components/medicion-consent").then((m) => m.MedicionConsent));
export const LocationConsentDiferido = diferido(() => import("@/components/location-consent").then((m) => m.LocationConsent));
export const PwaAvisosDiferido = diferido(() => import("@/components/pwa-avisos").then((m) => m.PwaAvisos));
