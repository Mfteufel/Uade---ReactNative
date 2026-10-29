// Mismos ids que la tabla categories del backend. Son fijas (las define la consigna).
export const CATEGORIES = [
  { id: 'documents', name: 'Documentos' },
  { id: 'keys', name: 'Llaves' },
  { id: 'electronics', name: 'Electrónica' },
  { id: 'pets', name: 'Mascotas' },
  { id: 'clothing', name: 'Ropa' },
  { id: 'other', name: 'Otros' },
];

export const categoryName = (id) => CATEGORIES.find((c) => c.id === id)?.name || '';
