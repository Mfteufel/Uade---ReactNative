// Texto de una línea para comentarios y agradecimientos: sin saltos de línea ni caracteres de control
// (el servidor los rechaza) y cortado a `max` caracteres reales (un emoji cuenta 1, igual que el servidor).
export function singleLine(text, max) {
  const clean = text.replace(/[\u0000-\u001F\u007F]+/g, ' ');
  const chars = [...clean];
  return chars.length > max ? chars.slice(0, max).join('') : clean;
}

export const charCount = (text) => [...text].length;
