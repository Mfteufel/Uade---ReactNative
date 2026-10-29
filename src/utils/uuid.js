// UUID v4 para el clientId de una publicación. No es para seguridad: solo tiene que no repetirse,
// así el servidor reconoce un reenvío de la misma publicación y no la duplica.
export function createUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random % 4) + 8;
    return value.toString(16);
  });
}
