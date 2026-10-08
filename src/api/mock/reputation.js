// Fórmula de reputación (la calcularía el backend):
//   puntos = devoluciones * 10 + valoraciones positivas * 2 - valoraciones negativas * 5   (mínimo 0)
// Devolver un objeto es lo que más suma; una valoración negativa pesa más que una positiva.
export function computeReputation(u) {
  const { completedReturns, positiveRatings, negativeRatings } = u;
  const totalRatings = positiveRatings + negativeRatings;
  const points = Math.max(0, completedReturns * 10 + positiveRatings * 2 - negativeRatings * 5);
  return {
    points,
    completedReturns,
    positiveRatings,
    negativeRatings,
    positivePercent: totalRatings ? Math.round((positiveRatings / totalRatings) * 100) : null,
  };
}
