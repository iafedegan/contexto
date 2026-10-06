import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Cada paso de una función de Inngest corre dentro de esta ruta: la sincronización del archivo usa hasta 240 s por paso.
export const maxDuration = 300;

// Punto de entrada que Inngest usa para ejecutar las funciones en segundo plano.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
