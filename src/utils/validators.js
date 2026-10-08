const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cada validador devuelve un mensaje de error, o '' si está todo bien.
export function validateEmail(email) {
  const value = email.trim();
  if (!value) return 'Ingresá tu email.';
  if (!EMAIL_REGEX.test(value)) return 'El email no tiene un formato válido.';
  return '';
}

export function validatePassword(password) {
  if (!password) return 'Ingresá una contraseña.';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  return '';
}

export function validateConfirm(password, confirm) {
  if (!confirm) return 'Repetí la contraseña.';
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return '';
}

export function validateOtp(code) {
  if (!/^\d{6}$/.test(code.trim())) return 'El código tiene 6 dígitos.';
  return '';
}

// El teléfono es opcional; si se completa, tiene que parecer un teléfono.
export function validatePhone(phone) {
  const value = phone.trim();
  if (!value) return '';
  if (!/^[+\d][\d\s()-]{5,19}$/.test(value)) return 'El teléfono no es válido. Usá solo números, espacios, + o guiones.';
  return '';
}

export function validateName(name) {
  if (!name.trim()) return 'Ingresá tu nombre.';
  if (name.trim().length < 2) return 'El nombre es muy corto.';
  return '';
}
