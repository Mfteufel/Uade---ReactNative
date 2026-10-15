// Para usar cuando existan los reclamos: ¿se le puede mostrar el teléfono de `user`
// a la otra parte del reclamo? Solo si el reclamo fue aceptado, el usuario eligió
// mostrarlo y cargó un teléfono.
export function canShowPhone(user, claim) {
  return !!user?.phone && user.phoneVisibleOnClaim === true && claim?.status === 'accepted';
}
