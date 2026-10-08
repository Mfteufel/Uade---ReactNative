// Para agregar una insignia, sumá un objeto a BADGES. No hay que tocar nada más.
//   metric: dato de la reputación a medir ('completedReturns' | 'positiveRatings' | 'points')
//   goal:   valor a alcanzar para ganarla
export const BADGES = [
  { id: 'first_return', name: 'Primer paso', icon: '🌱', description: '1 devolución concretada', metric: 'completedReturns', goal: 1 },
  { id: 'solidary_neighbor', name: 'Vecino solidario', icon: '🤝', description: '5 devoluciones concretadas', metric: 'completedReturns', goal: 5 },
  { id: 'neighborhood_guardian', name: 'Guardián del barrio', icon: '🛡️', description: '10 devoluciones concretadas', metric: 'completedReturns', goal: 10 },
  { id: 'well_rated', name: 'Muy valorado', icon: '⭐', description: '10 valoraciones positivas', metric: 'positiveRatings', goal: 10 },
];

// Devuelve las insignias ganadas según la reputación del usuario.
export function getEarnedBadges(reputation) {
  if (!reputation) return [];
  return BADGES.filter((badge) => (reputation[badge.metric] ?? 0) >= badge.goal);
}
