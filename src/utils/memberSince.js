// "Miembro desde marzo de 2024 · 2 años"
export function formatMemberSince(isoDate) {
  const date = new Date(isoDate);
  const now = new Date();
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());

  let age;
  if (months < 1) age = 'recién se unió';
  else if (months < 12) age = months === 1 ? '1 mes' : `${months} meses`;
  else {
    const years = Math.floor(months / 12);
    age = years === 1 ? '1 año' : `${years} años`;
  }
  const since = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return `Miembro desde ${since} · ${age}`;
}
