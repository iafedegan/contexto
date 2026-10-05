import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Punto de entrada que Inngest usa para ejecutar las funciones en segundo plano.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
