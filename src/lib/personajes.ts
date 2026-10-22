/**
 * Personajes del asistente flotante y sus «gestos» al estilo del Clippy de Office: de vez en cuando hacen algo (guiñar, saludar, tocarse el
 * sombrero, girar el lazo…) y sueltan una frase corta. Aquí solo hay datos y la elección del siguiente gesto (sin React, para poder probarla).
 */
export type PersonajeId = "toro" | "ganadero";

export type Gesto = { id: string; es: string; en: string };

export type Personaje = {
  id: PersonajeId;
  nombre: { es: string; en: string };
  /** Proporción del dibujo (ancho × alto del viewBox), para calcular el tamaño en pantalla. */
  ancho: number;
  alto: number;
  gestos: Gesto[];
};

export const PERSONAJES: Record<PersonajeId, Personaje> = {
  toro: {
    id: "toro",
    nombre: { es: "El toro", en: "The bull" },
    ancho: 240,
    alto: 230,
    gestos: [
      { id: "guino", es: "¡Muuu! ¿Qué quieres saber?", en: "Moo! What would you like to know?" },
      { id: "cabeceo", es: "Pregúntame por los precios del ganado.", en: "Ask me about cattle prices." },
      { id: "resoplido", es: "¡Uf! Hoy hay mucha noticia en el campo.", en: "Phew! Lots of news from the countryside today." },
      { id: "salto", es: "Tengo 51 mil notas del archivo para ti.", en: "I have 51,000 archive stories for you." },
    ],
  },
  ganadero: {
    id: "ganadero",
    nombre: { es: "Don José Félix", en: "Don José Félix" },
    ancho: 200,
    alto: 330,
    gestos: [
      { id: "saludo", es: "¡Buenas! ¿En qué le puedo ayudar?", en: "Hello! How can I help you?" },
      { id: "sombrero", es: "Un saludo desde el campo.", en: "Greetings from the countryside." },
      { id: "lazo", es: "¡A lazar las noticias del sector!", en: "Let's lasso the sector's news!" },
      { id: "idea", es: "Pregúntame por el precio del novillo gordo.", en: "Ask me about the price of fattened cattle." },
      { id: "explica", es: "Déjeme le explico: pregunte sin pena.", en: "Let me explain: just ask." },
    ],
  },
};

export const ORDEN_PERSONAJES: PersonajeId[] = ["toro", "ganadero"];

/** El que sigue en la rueda de personajes (para el botón «Cambiar personaje»). */
export function siguientePersonaje(actual: PersonajeId): PersonajeId {
  const i = ORDEN_PERSONAJES.indexOf(actual);
  return ORDEN_PERSONAJES[(i + 1) % ORDEN_PERSONAJES.length];
}

/** Valida lo guardado en el navegador: si no es un personaje conocido, el toro de siempre. */
export function personajeValido(valor: unknown): PersonajeId {
  return valor === "ganadero" ? "ganadero" : "toro";
}

/** Elige el próximo gesto sin repetir el anterior. `azar` devuelve un número en [0, 1) (se inyecta para poder probarlo). */
export function siguienteGesto(personaje: PersonajeId, anterior: string | null, azar: () => number = Math.random): Gesto {
  const todos = PERSONAJES[personaje].gestos;
  const candidatos = todos.length > 1 ? todos.filter((g) => g.id !== anterior) : todos;
  return candidatos[Math.min(candidatos.length - 1, Math.floor(azar() * candidatos.length))];
}

/** Espera aleatoria hasta el próximo gesto, entre 18 y 42 segundos: se nota que está vivo sin cansar. */
export function esperaDeGesto(azar: () => number = Math.random): number {
  return Math.round(18_000 + azar() * 24_000);
}
