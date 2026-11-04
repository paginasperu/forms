const fileRules = {
  cv: {
    maxBytes: 2 * 1024 * 1024,
    extensions: ['pdf'],
    message: 'El CV debe ser PDF y pesar hasta 2 MB.'
  },
  foto: {
    maxBytes: 1024 * 1024,
    extensions: ['jpg', 'jpeg', 'jfif', 'png'],
    message: 'La foto debe ser JPG, JPEG o PNG y pesar hasta 1 MB.'
  }
};

// Se activa cuando se publique la Web App de Apps Script.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBQhixsXAoqT7UpwAwxFMgf_PmM4RPvQhe3SG2XmDsNv_IGBfNjXgkZ4kr2741rFMA/exec';
const formStartedAt = Date.now();
const submissionId = crypto.randomUUID();

async function fileValidationError(field, file) {
  const rule = fileRules[field];
  const label = field === 'cv' ? 'El CV' : 'La foto';
  if (!file || file.size === 0) return `${label} no contiene datos. Selecciona otro archivo`;
  if (file.size > rule.maxBytes) return `${label} pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. El máximo es ${rule.maxBytes / 1024 / 1024} MB`;
  const extension = file.name.split('.').pop().toLowerCase();
  if (!rule.extensions.includes(extension)) {
    return field === 'cv'
      ? 'Formato no admitido. El CV debe ser PDF; no se aceptan fotos ni capturas'
      : 'Formato no admitido. Usa una foto JPG, JPEG, JFIF o PNG';
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (field === 'cv') {
    const limit = Math.min(bytes.length - 5, 1024);
    for (let i = 0; i <= limit; i++) {
      if ([37, 80, 68, 70, 45].every((value, offset) => bytes[i + offset] === value)) return '';
    }
    return 'El contenido del archivo no corresponde a un PDF. Selecciona un PDF válido';
  }
  const isJpeg = bytes.length >= 5 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 &&
    bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  const pngStart = [137, 80, 78, 71, 13, 10, 26, 10];
  const pngEnd = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
  const isPng = bytes.length >= 33 && pngStart.every((value, i) => bytes[i] === value) &&
    pngEnd.every((value, i) => bytes[bytes.length - pngEnd.length + i] === value);
  if ((extension === 'png' && isPng) || (['jpg', 'jpeg', 'jfif'].includes(extension) && isJpeg)) return '';
  return 'El contenido de la foto no coincide con su extensión o está incompleto. Selecciona otra foto o expórtala como JPEG o PNG';
}

function fileStatus(field) {
  return document.getElementById(field === 'foto' ? 'photo-status' : 'cv-status');
}

for (const field of Object.keys(fileRules)) {
  const input = document.querySelector(`[name="${field}"]`);
  const status = fileStatus(field);
  input.setAttribute('aria-describedby', status.id);
  let selection = 0;
  input.addEventListener('change', async () => {
    const current = ++selection;
    const file = input.files[0];
    status.classList.remove('error');
    input.removeAttribute('aria-invalid');
    status.textContent = '';
    if (!file) return;
    status.textContent = 'Revisando archivo…';
    let error;
    try {
      error = await fileValidationError(field, file);
    } catch (_) {
      error = 'No se pudo leer el archivo. Vuelve a seleccionarlo';
    }
    if (current !== selection) return;
    status.textContent = error || file.name;
    status.classList.toggle('error', Boolean(error));
    if (error) {
      input.value = '';
      input.setAttribute('aria-invalid', 'true');
    }
  });
}

for (const input of document.querySelectorAll('[name="nombres"], [name="apellidos"]')) {
  input.addEventListener('input', () => {
    const before = input.value;
    const caret = input.selectionStart ?? before.length;
    const allowedBeforeCaret = before.slice(0, caret).replace(/[^\p{L}\p{M}\s'-]/gu, '').length;
    input.value = before.replace(/[^\p{L}\p{M}\s'-]/gu, '');
    input.setSelectionRange(allowedBeforeCaret, allowedBeforeCaret);
  });

  input.addEventListener('blur', () => {
    input.value = input.value.trim().replace(/\s+/g, ' ');
  });
}

const whatsapp = document.querySelector('[name="whatsapp"]');
whatsapp.addEventListener('input', () => {
  const before = whatsapp.value;
  const caret = whatsapp.selectionStart ?? before.length;
  const digitsBeforeCaret = before.slice(0, caret).replace(/\D/g, '').length;
  let raw = before.trim().replace(/^(?:\+51|0051)/, '');
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  const formatted = digits.replace(/(\d{3})(?=\d)/g, '$1 ');
  whatsapp.value = formatted;

  let position = 0;
  let digitsSeen = 0;
  while (position < formatted.length && digitsSeen < digitsBeforeCaret) {
    if (/\d/.test(formatted[position])) digitsSeen++;
    position++;
  }
  whatsapp.setSelectionRange(position, position);
});

const socialLink = document.querySelector('[name="red_social"]');
const socialError = document.getElementById('social-error');
function validateSocialLink() {
  const value = socialLink.value.trim();
  socialLink.value = value;
  const valid = !value || (value.length <= 2048 && /^https?:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value));
  const message = valid ? '' : 'Introduce un enlace completo a una web o red social';
  socialLink.setCustomValidity(message);
  socialError.textContent = message;
  socialError.hidden = valid;
  if (valid) socialLink.removeAttribute('aria-invalid');
  else socialLink.setAttribute('aria-invalid', 'true');
  return valid;
}
socialLink.addEventListener('input', () => {
  socialLink.setCustomValidity('');
  socialError.hidden = true;
  socialLink.removeAttribute('aria-invalid');
});
socialLink.addEventListener('blur', () => {
  const value = socialLink.value.trim();
  if (value && !/^https?:\/\//i.test(value)) socialLink.value = `https://${value}`;
  validateSocialLink();
});

const presentation = document.querySelector('[name="presentacion"]');
presentation.addEventListener('input', () => {
  presentation.setCustomValidity(presentation.value.trim() ? '' : 'Escribe una breve presentación.');
});

const applicationForm = document.getElementById('application-form');
const availabilityInputs = [...document.querySelectorAll('[name="horarios_disponibles"]')];
const availabilityError = document.getElementById('availability-error');
let availabilityTouched = false;

function updateAvailabilityValidation(showError = availabilityTouched) {
  const hasAvailability = availabilityInputs.some(input => input.checked);
  availabilityError.hidden = hasAvailability || !showError;
  return hasAvailability;
}

availabilityInputs.forEach(input => {
  input.addEventListener('change', () => {
    availabilityTouched = true;
    updateAvailabilityValidation();
  });
});

applicationForm.addEventListener('submit', async event => {
  event.preventDefault();
  validateAdultAge();
  validateSocialLink();
  if (!applicationForm.reportValidity()) return;
  if (!updateAvailabilityValidation(true)) {
    availabilityInputs[0].focus();
    return;
  }

  const status = document.getElementById('form-status');
  const submitButton = document.getElementById('submit-button');
  status.hidden = false;
  status.classList.remove('success', 'error');

  if (!APPS_SCRIPT_URL) {
    status.textContent = 'El formulario aún no está conectado. No se envió ni guardó tu información.';
    status.classList.add('error');
    return;
  }

  for (const field of Object.keys(fileRules)) {
    const input = applicationForm.elements[field];
    let error;
    try { error = await fileValidationError(field, input.files[0]); }
    catch (_) { error = 'No se pudo leer el archivo. Vuelve a seleccionarlo'; }
    if (error) {
      const item = fileStatus(field);
      item.textContent = error;
      item.classList.add('error');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      status.textContent = 'Revisa el archivo señalado antes de enviar';
      status.classList.add('error');
      return;
    }
  }

  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');
  submitButton.textContent = 'Enviando…';
  status.textContent = 'Enviando tu postulación…';

  try {
    const payload = {
      id: submissionId,
      origin: location.origin,
      formStartedAt,
      website: applicationForm.elements.website.value,
      nombres: applicationForm.elements.nombres.value.trim(),
      apellidos: applicationForm.elements.apellidos.value.trim(),
      fecha_nacimiento: applicationForm.elements.fecha_nacimiento.value,
      distrito: applicationForm.elements.distrito.value,
      whatsapp: applicationForm.elements.whatsapp.value,
      red_social: applicationForm.elements.red_social.value.trim(),
      presentacion: applicationForm.elements.presentacion.value.trim(),
      horarios_disponibles: availabilityInputs.filter(input => input.checked).map(input => input.value),
      acepta_entrevista: applicationForm.elements.acepta_entrevista.checked,
      acepta_politica_privacidad: applicationForm.elements.acepta_politica_privacidad.checked,
      files: {
        cv: await fileAsBase64(applicationForm.elements.cv.files[0]),
        foto: await fileAsBase64(applicationForm.elements.foto.files[0])
      }
    };
    submitPayload(payload);
  } catch (error) {
    status.textContent = 'No se pudieron preparar los archivos. Vuelve a seleccionarlos e inténtalo otra vez.';
    status.classList.add('error');
    submitButton.removeAttribute('aria-busy');
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar postulación';
  }
});

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('missing-file'));
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.split(',')[1];
      if (!base64) return reject(new Error('invalid-file-data'));
      resolve({ name: file.name, base64 });
    };
    reader.onerror = () => reject(new Error('file-read-error'));
    reader.readAsDataURL(file);
  });
}

function submitPayload(payload) {
  const frame = document.getElementById('submission-frame');
  const submitButton = document.getElementById('submit-button');
  const status = document.getElementById('form-status');
  const outboundForm = document.createElement('form');
  outboundForm.method = 'POST';
  outboundForm.action = APPS_SCRIPT_URL;
  outboundForm.target = frame.name;
  outboundForm.hidden = true;
  const payloadInput = document.createElement('input');
  payloadInput.type = 'hidden';
  payloadInput.name = 'payload';
  payloadInput.value = JSON.stringify(payload);
  outboundForm.append(payloadInput);
  document.body.append(outboundForm);

  const requestId = payload.id;
  let completed = false;
  const timeout = window.setTimeout(() => {
    if (completed) return;
    cleanup();
    status.textContent = 'No pudimos confirmar el envío por un problema técnico del formulario. Inténtalo más tarde.';
    status.classList.add('error');
    submitButton.removeAttribute('aria-busy');
    submitButton.disabled = false;
    submitButton.textContent = 'Enviar postulación';
  }, 30000);

  function cleanup() {
    submitButton.removeAttribute('aria-busy');
    window.clearTimeout(timeout);
    window.removeEventListener('message', onMessage);
    outboundForm.remove();
  }

  function onMessage(event) {
    const trustedOrigin = event.origin === 'https://script.google.com' ||
      /^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(event.origin);
    if (!trustedOrigin || !isSubmissionFrameSource(event.source, frame.contentWindow)) return;
    const message = event.data;
    if (!message || message.channel !== 'oficial-promotoras' || message.id !== requestId) return;
    completed = true;
    cleanup();
    if (message.ok) {
      applicationForm.reset();
      birthParts.forEach(input => { input.setCustomValidity(''); input.removeAttribute('aria-invalid'); });
      birthDateError.hidden = true;
      socialLink.setCustomValidity('');
      socialError.hidden = true;
      socialLink.removeAttribute('aria-invalid');
      document.querySelectorAll('.file-status').forEach(item => { item.textContent = ''; });
      availabilityTouched = false;
      updateAvailabilityValidation(false);
      status.textContent = 'Tu postulación fue recibida. Gracias por tu interés.';
      status.classList.add('success');
      submitButton.textContent = 'Postulación enviada';
    } else {
      const errorMessages = {
        INVALID_SUBMISSION: 'El receptor rechazó los datos enviados',
        CONSENT_REQUIRED: 'Debes aceptar la entrevista y la política de privacidad',
        UNDERAGE: 'Debes tener 18 años cumplidos para postular',
        INVALID_FILE: 'El receptor rechazó el formato o contenido del CV o de la foto',
        REQUEST_TOO_LARGE: 'Los archivos enviados superan el tamaño permitido',
        BUSY: 'El receptor está ocupado',
        SHEET_NOT_READY: 'No se encontró la pestaña configurada en Google Sheets',
        SHEET_HEADERS_MISMATCH: 'Las columnas de Google Sheets no coinciden con la configuración',
        STORAGE_NOT_PRIVATE: 'La configuración de acceso de la hoja o carpeta no coincide con la requerida',
        RECORD_IDS_INVALID: 'La numeración de registros necesita revisión del responsable',
        ID_STATE_INVALID: 'No se pudo asignar el número de postulación',
        SERVER_ERROR: 'Ocurrió un error interno en Apps Script'
      };
      const code = Object.hasOwn(errorMessages, message.code) ? message.code : 'UNKNOWN_ERROR';
      status.textContent = `${errorMessages[code] || 'El receptor devolvió un error inesperado'}. Referencia: ${code}`;
      status.classList.add('error');
      submitButton.removeAttribute('aria-busy');
      submitButton.disabled = false;
      submitButton.textContent = 'Enviar postulación';
    }
  }

  window.addEventListener('message', onMessage);
  status.textContent = 'Enviando tu postulación…';
  submitButton.textContent = 'Enviando…';
  outboundForm.submit();
}

function isSubmissionFrameSource(source, frameWindow) {
  try {
    for (let depth = 0; source && depth < 10; depth++) {
      if (source === frameWindow) return true;
      if (source === source.parent) return false;
      source = source.parent;
    }
  } catch (_) {
    return false;
  }
  return false;
}

const privacyLink = document.getElementById('privacy-link');
const privacyDetails = document.getElementById('privacy-details');
privacyLink.addEventListener('click', event => {
  event.preventDefault();
  privacyDetails.hidden = !privacyDetails.hidden;
  privacyLink.setAttribute('aria-expanded', String(!privacyDetails.hidden));
  privacyDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

});

const birthDate = document.querySelector('[name="fecha_nacimiento"]');
const birthParts = ['birth_day', 'birth_month', 'birth_year'].map(name => applicationForm.elements[name]);
const birthDateError = document.getElementById('birthdate-error');

function birthDateResult(dayText, monthText, yearText, today = new Date()) {
  if (!dayText || !monthText || !yearText) return { error: 'Completa el día, mes y año de nacimiento' };
  if (!/^[1-9][0-9]{3}$/.test(yearText)) return { error: 'Escribe el año completo con cuatro cifras, sin ceros al inicio' };
  if (!/^\d{1,2}$/.test(dayText) || !/^\d{1,2}$/.test(monthText)) return { error: 'Revisa el día y el mes de nacimiento' };
  const day = Number(dayText), month = Number(monthText), year = Number(yearText);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return { error: 'La fecha no existe. Revisa el día, mes y año' };
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  if (age < 18) return { error: 'Para postular, debes tener 18 años cumplidos' };
  return { value: `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

function validateAdultAge(showError = true) {
  birthParts.forEach(input => { input.setCustomValidity(''); input.removeAttribute('aria-invalid'); });
  const result = birthDateResult(...birthParts.map(input => input.value.trim()));
  birthDate.value = result.value || '';
  const message = result.error || '';
  if (message) {
    const target = birthParts.find(input => !input.value) || birthParts[2];
    target.setCustomValidity(message);
    if (showError) target.setAttribute('aria-invalid', 'true');
  }
  birthDateError.textContent = showError ? message : '';
  birthDateError.hidden = !showError || !message;
  return !message;
}

birthParts.forEach(input => {
  input.addEventListener('input', () => {
    if (input.tagName === 'INPUT') input.value = input.value.replace(/\D/g, '');
    validateAdultAge(birthParts.every(part => part.value));
  });
  input.addEventListener('change', () => validateAdultAge(birthParts.every(part => part.value)));
});

const photoExampleToggle = document.getElementById('photo-example-toggle');
const photoExample = document.getElementById('photo-example');
photoExampleToggle.addEventListener('click', () => {
  photoExample.hidden = !photoExample.hidden;
  photoExampleToggle.setAttribute('aria-expanded', String(!photoExample.hidden));
  photoExampleToggle.textContent = photoExample.hidden ? 'Ver ejemplo' : 'Ocultar ejemplo';
});
