// Publicaciones de ejemplo para probar y mostrar "Mis publicaciones" en la demo.
// Las fechas se calculan desde hoy, así siempre hay una por vencer y una vencida.
const DAY_MS = 24 * 60 * 60 * 1000;

const daysFromNow = (days) => new Date(Date.now() + days * DAY_MS);
const isoDay = (date) => date.toISOString().slice(0, 10);

function sample({ id, userId, type, title, description, category, neighborhood, address, createdDaysAgo, status, question, answer }) {
  const createdAt = daysFromNow(-createdDaysAgo);
  return {
    id,
    userId,
    clientId: `00000000-0000-4000-8000-${id.replace(/\D/g, '').padStart(12, '0')}`,
    type,
    title,
    description,
    category,
    occurredOn: isoDay(createdAt),
    timeFrom: '09:00',
    timeTo: '11:00',
    neighborhood,
    exactAddress: address,
    latitude: null,
    longitude: null,
    verificationQuestion: type === 'found' ? question : null,
    verificationAnswer: type === 'found' ? answer : null,
    status,
    expiresAt: new Date(createdAt.getTime() + 30 * DAY_MS).toISOString(),
    renewedAt: null,
    createdAt: createdAt.toISOString(),
    photoUrls: [],
  };
}

export function createSamplePublications() {
  return [
    sample({
      id: 'p_demo_000001',
      userId: 'u_lucia',
      type: 'found',
      title: 'Llaves con llavero rojo',
      description: 'Estaban en un banco de la plaza, cerca de la calesita.',
      category: { id: 'keys', name: 'Llaves' },
      neighborhood: { id: 'palermo', name: 'Palermo' },
      address: 'Plaza Armenia, banco junto a la calesita',
      createdDaysAgo: 2,
      status: 'open',
      question: '¿De qué color es el llavero?',
      answer: 'Rojo',
    }),
    sample({
      id: 'p_demo_000002',
      userId: 'u_lucia',
      type: 'lost',
      title: 'Perro caniche blanco "Toby"',
      description: 'Tiene collar azul con chapita. Es muy manso.',
      category: { id: 'pets', name: 'Mascotas' },
      neighborhood: { id: 'villa-crespo', name: 'Villa Crespo' },
      address: 'Av. Corrientes 5500',
      createdDaysAgo: 26, // le quedan 4 días: muestra el botón Renovar
      status: 'open',
    }),
    sample({
      id: 'p_demo_000003',
      userId: 'u_lucia',
      type: 'lost',
      title: 'Billetera de cuero marrón',
      description: 'Con DNI y tarjeta SUBE a nombre de Lucía.',
      category: { id: 'documents', name: 'Documentos' },
      neighborhood: { id: 'recoleta', name: 'Recoleta' },
      address: 'Av. Santa Fe 1800',
      createdDaysAgo: 34, // ya pasó los 30 días: aparece como vencida
      status: 'open',
    }),
    sample({
      id: 'p_demo_000004',
      userId: 'u_lucia',
      type: 'found',
      title: 'Celular Samsung con funda negra',
      description: 'Lo encontré en el colectivo 152.',
      category: { id: 'electronics', name: 'Electrónica' },
      neighborhood: { id: 'belgrano', name: 'Belgrano' },
      address: 'Av. Cabildo 2000, parada del 152',
      createdDaysAgo: 6,
      status: 'in_claim',
      question: '¿Qué foto tiene de fondo de pantalla?',
      answer: 'Un perro',
    }),
    sample({
      id: 'p_demo_000005',
      userId: 'u_lucia',
      type: 'found',
      title: 'Campera de jean talle M',
      description: null,
      category: { id: 'clothing', name: 'Ropa' },
      neighborhood: { id: 'caballito', name: 'Caballito' },
      address: 'Parque Centenario, junto al lago',
      createdDaysAgo: 15,
      status: 'resolved',
      question: '¿Qué tiene en el bolsillo izquierdo?',
      answer: 'Un encendedor',
    }),
    sample({
      id: 'p_demo_000006',
      userId: 'u_martin',
      type: 'lost',
      title: 'Mochila negra con notebook',
      description: 'Me la olvidé en un bar.',
      category: { id: 'electronics', name: 'Electrónica' },
      neighborhood: { id: 'san-telmo', name: 'San Telmo' },
      address: 'Defensa 900',
      createdDaysAgo: 1,
      status: 'open',
    }),
  ];
}
