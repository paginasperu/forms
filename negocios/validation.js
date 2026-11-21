function businessFieldMessage(name, raw) {
  const rules = {
    lugar: { min: 2, max: 160, kind: 'text' },
    piso: { min: 1, max: 3, kind: 'floor' },
    seccion: { min: 1, max: 80, kind: 'text' },
    pasillo: { min: 0, max: 20, kind: 'code' },
    tipo: { min: 2, max: 80, kind: 'text' },
    nombre: { min: 2, max: 120, kind: 'text' },
    local: { min: 1, max: 20, kind: 'code' }
  };
  const rule = rules[name];
  if (!rule) return '';
  if (typeof raw !== 'string') return 'Ingresa un valor válido';
  const value = raw.trim().replace(/\s+/g, ' ');
  if (!value) return rule.min ? 'Completa este campo' : '';
  if (/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069]/.test(raw)) return 'Quita los caracteres de control o invisibles';
  if (value.length < rule.min) return 'Escribe al menos ' + rule.min + ' caracteres';
  if (value.length > rule.max) return 'Usa como máximo ' + rule.max + ' caracteres';
  if (rule.kind === 'floor') return /^[0-9]{1,3}$/.test(value) ? '' : 'Usa solo dígitos para el piso';
  if (rule.kind === 'code') return /^[\p{L}\p{N} .\/-]+$/u.test(value) && /[\p{L}\p{N}]/u.test(value) ? '' : 'Usa letras, números, espacios, guion, punto o barra';
  return /^[\p{L}\p{M}\p{N} &'’.,()/+#°º-]+$/u.test(value) && /\p{L}/u.test(value) ? '' : 'Usa un nombre con letras y signos habituales, sin símbolos extraños';
}
function businessSocialValid(value) {
  if (!value) return true;
  const match = /^https?:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::([0-9]{1,5}))?(?:[/?#][^\s<>\\]*)?$/i.exec(value);
  return value.length <= 2048 && !!match && (!match[1] || (Number(match[1]) > 0 && Number(match[1]) <= 65535));
}
