const fileRules = {
  cv: {
    maxBytes: 2 * 1024 * 1024,
    extensions: ['pdf', 'docx'],
    message: 'El CV debe ser PDF o DOCX y pesar hasta 2 MB.'
  },
  foto: {
    maxBytes: 2 * 1024 * 1024,
    extensions: ['jpg', 'jpeg', 'jfif', 'png'],
    message: 'La foto debe ser JPG, JPEG o PNG y pesar hasta 2 MB.'
  }
};

// Se activa cuando se publique la Web App de Apps Script.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBQhixsXAoqT7UpwAwxFMgf_PmM4RPvQhe3SG2XmDsNv_IGBfNjXgkZ4kr2741rFMA/exec';
const formStartedAt = Date.now();
let submissionId = crypto.randomUUID();

function hasAsciiSequence(bytes, text) {
  const sequence = [...text].map(character => character.charCodeAt(0));
  for (let i = 0; i <= bytes.length - sequence.length; i++) {
    if (sequence.every((value, offset) => bytes[i + offset] === value)) return true;
  }
  return false;
}

async function fileValidationError(field, file) {
  const rule = fileRules[field];
  const label = field === 'cv' ? 'El CV' : 'La foto';
  if (!file || file.size === 0) return `${label} no contiene datos. Selecciona otro archivo`;
  if (file.size > rule.maxBytes) return `${label} pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. El máximo es ${rule.maxBytes / 1024 / 1024} MB`;
  const extension = file.name.split('.').pop().toLowerCase();
  if (!rule.extensions.includes(extension)) {
    return field === 'cv'
      ? 'Formato no admitido. El CV debe ser PDF o DOCX; no se aceptan archivos DOC ni imágenes'
      : 'Formato no admitido. Usa una foto JPG, JPEG, JFIF o PNG';
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (field === 'cv') {
    if (extension === 'pdf') {
      const limit = Math.min(bytes.length - 5, 1024);
      for (let i = 0; i <= limit; i++) {
        if ([37, 80, 68, 70, 45].every((value, offset) => bytes[i + offset] === value)) return '';
      }
      return 'El contenido del archivo no corresponde a un PDF. Selecciona un PDF válido';
    }
    const isZip = bytes.length >= 4 && bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4;
    if (isZip && hasAsciiSequence(bytes, '[Content_Types].xml') && hasAsciiSequence(bytes, 'word/document.xml')) return '';
    return 'El contenido del archivo no corresponde a un DOCX válido. Selecciona un documento de Word válido';
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
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), status.id].filter(Boolean).join(' '));
  const pickerLabel = input.closest('.file-picker').querySelector('.picker-label');
  let selection = 0;
  input.form.addEventListener('reset', () => {
    selection++;
    pickerLabel.textContent = 'Subir';
    status.textContent = '';
    status.classList.remove('error');
    input.removeAttribute('aria-invalid');
  });
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
    pickerLabel.textContent = error ? 'Subir' : 'Cambiar';
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
    const allowedBeforeCaret = before.slice(0, caret).replace(/[^\p{L}\p{M}\s-]/gu, '').length;
    input.value = before.replace(/[^\p{L}\p{M}\s-]/gu, '');
    input.setSelectionRange(allowedBeforeCaret, allowedBeforeCaret);
  });

  input.addEventListener('blur', () => {
    input.value = input.value.trim().replace(/\s+/g, ' ');
  });
}

const whatsapp = document.querySelector('[name="whatsapp"]');
function formatWhatsapp(value, caret = value.length) {
  const digitsBeforeCaret = value.slice(0, caret).replace(/\D/g, '').length;
  const digits = value.replace(/\D/g, '');
  const formatted = digits.replace(/(\d{3})(?=\d)/g, '$1 ');
  whatsapp.value = formatted;
  let position = 0;
  let seen = 0;
  while (position < formatted.length && seen < digitsBeforeCaret) {
    if (/\d/.test(formatted[position])) seen++;
    position++;
  }
  whatsapp.setSelectionRange(position, position);
}

function validateWhatsapp() {
  const value = whatsapp.value;
  const digits = value.replace(/\D/g, '');
  const message = value && (!/^[\d ]+$/.test(value) || digits.length > 9 ||
    (digits.length === 9 && !digits.startsWith('9')))
    ? fieldMessages.whatsapp : '';
  whatsapp.setCustomValidity(message);
  showFieldError(whatsapp, message);
}

whatsapp.addEventListener('beforeinput', event => {
  const start = whatsapp.selectionStart;
  const end = whatsapp.selectionEnd;
  if (event.inputType === 'insertText' && event.data) {
    const next = whatsapp.value.slice(0, start) + event.data + whatsapp.value.slice(end);
    const currentLength = whatsapp.value.replace(/\D/g, '').length;
    const nextLength = next.replace(/\D/g, '').length;
    if (/\D/.test(event.data) || (nextLength > 9 && nextLength >= currentLength)) event.preventDefault();
  }
  // Delete a digit across a grouping space instead of reinserting the space.
  if (start === end && ((event.inputType === 'deleteContentBackward' && whatsapp.value[start - 1] === ' ') ||
    (event.inputType === 'deleteContentForward' && whatsapp.value[start] === ' '))) {
    event.preventDefault();
    const from = event.inputType === 'deleteContentBackward' ? start - 2 : start;
    const to = event.inputType === 'deleteContentBackward' ? start : start + 2;
    const next = whatsapp.value.slice(0, from) + whatsapp.value.slice(to);
    formatWhatsapp(next, from);
    whatsapp.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

whatsapp.addEventListener('paste', event => {
  event.preventDefault();
  const pasted = event.clipboardData.getData('text').trim();
  const local = pasted.replace(/^(?:\+51|0051)\s*/, '');
  const replacement = /^[\d\s().-]+$/.test(local) ? local.replace(/\D/g, '') : pasted;
  whatsapp.setRangeText(replacement, whatsapp.selectionStart, whatsapp.selectionEnd, 'end');
  whatsapp.dispatchEvent(new Event('input', { bubbles: true }));
});

whatsapp.addEventListener('input', () => {
  if (/^[\d ]*$/.test(whatsapp.value) && whatsapp.value.replace(/\D/g, '').length <= 9) {
    formatWhatsapp(whatsapp.value, whatsapp.selectionStart ?? whatsapp.value.length);
  }
  validateWhatsapp();
});
whatsapp.addEventListener('blur', () => {
  validateWhatsapp();
  if (whatsapp.value && !whatsapp.validity.valid) showFieldError(whatsapp, fieldMessages.whatsapp);
});

const socialLink = document.querySelector('[name="red_social"]');
const portfolioLink = document.querySelector('[name="portafolio"]');
const portfolioError = document.getElementById('portfolio-error');
function isProfileUrl(value) {
  return (value.length <= 2048 && /^https?:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value));
}

function normalizeProfileLink(input) {
  const value = input.value.trim();
  const candidate = 'https://' + value;
  input.value = value && isProfileUrl(candidate) ? candidate : value;
  return input.value;
}

function validateSocialLink() {
  const value = normalizeProfileLink(socialLink);
  const message = value && !isProfileUrl(value) ? fieldMessages.red_social : '';
  socialLink.setCustomValidity(message);
  if (message || document.getElementById('red_social-validation-error')) showFieldError(socialLink, message);
}

function validatePortfolioLink() {
  const value = normalizeProfileLink(portfolioLink);
  const valid = !value || isProfileUrl(value);
  const message = valid ? '' : 'Introduce un enlace completo a una red social o página web';
  portfolioLink.setCustomValidity(message);
  portfolioError.textContent = message;
  portfolioError.hidden = valid;
  if (valid) portfolioLink.removeAttribute('aria-invalid');
  else portfolioLink.setAttribute('aria-invalid', 'true');
  return valid;
}
portfolioLink.addEventListener('input', () => {
  portfolioLink.setCustomValidity('');
  portfolioError.hidden = true;
  portfolioLink.removeAttribute('aria-invalid');
});
portfolioLink.addEventListener('blur', validatePortfolioLink);
socialLink.addEventListener('blur', validateSocialLink);
socialLink.addEventListener('input', () => socialLink.setCustomValidity(''));

const presentation = document.querySelector('[name="presentacion"]');
function validatePresentation() {
  const length = presentation.value.trim().length;
  presentation.setCustomValidity(length >= 40 && length <= 300 ? '' : 'Escribe entre 40 y 300 caracteres');
}
const presentationCounter = document.getElementById('presentation-counter');
function updatePresentationCounter() {
  const length = presentation.value.trim().length;
  presentationCounter.textContent = length + '/300' + (length < 40 ? ' · Mínimo 40 caracteres' : '');
}
presentation.addEventListener('input', () => {
  validatePresentation();
  updatePresentationCounter();
});
presentation.form.addEventListener('reset', () => {
  queueMicrotask(updatePresentationCounter);
});
updatePresentationCounter();

const applicationForm = document.getElementById('application-form');
const availabilityInputs = [...document.querySelectorAll('[name="horarios_disponibles"]')];
const availabilityError = document.getElementById('availability-error');
const fieldMessages = {
  cv: 'Selecciona tu CV',
  foto: 'Selecciona tu foto',
  nombres: 'Ingresa tus nombres',
  apellidos: 'Ingresa tus apellidos',
  nacionalidad: 'Selecciona tu nacionalidad',
  birth_day: 'Ingresa el día de nacimiento',
  birth_month: 'Selecciona el mes de nacimiento',
  birth_year: 'Ingresa el año de nacimiento',
  ubicacion: 'Elige un distrito de las sugerencias',
  whatsapp: 'Ingresa un celular peruano de 9 dígitos que empiece en 9',
  red_social: 'Ingresa un enlace válido a tu perfil',
  tarifa_hora: 'Ingresa un monto entero entre S/10 y S/100',
  presentacion: 'Escribe entre 40 y 300 caracteres',
  acepta_entrevista: 'Confirma que aceptas la entrevista',
  acepta_politica_privacidad: 'Acepta la política de privacidad'
};

function showFieldError(input, message) {
  const id = input.name + '-validation-error';
  let error = document.getElementById(id);
  if (!error) {
    error = document.createElement('small');
    error.id = id;
    error.className = 'field-hint field-error';
    error.setAttribute('aria-live', 'polite');
    if (input.type === 'file') fileStatus(input.name).after(error);
    else if (input.type === 'checkbox') input.closest('label').after(error);
    else (input.closest('label') || input.closest('.text-field')).append(error);
    const descriptions = input.getAttribute('aria-describedby');
    input.setAttribute('aria-describedby', [descriptions, id].filter(Boolean).join(' '));
  }
  error.textContent = message;
  error.hidden = !message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function clearFieldError(event) {
  const input = event.target;
  if ((input === whatsapp || input.name === 'tarifa_hora') && input.validity.customError) return;
  if (document.getElementById(input.name + '-validation-error')) showFieldError(input, '');
}

applicationForm.addEventListener('reset', () => whatsapp.setCustomValidity(''));
applicationForm.addEventListener('input', clearFieldError);
applicationForm.addEventListener('change', clearFieldError);
applicationForm.noValidate = true;

const positionsByModality = {
  Remoto: ['Asistente administrativo', 'Diseñadora gráfica', 'Creadora de contenido'],
  Presencial: ['Volantera', 'Anfitriona', 'Promotora']
};
const modalityInputs = [...document.querySelectorAll('[name="modalidad"]')];
const positionField = document.getElementById('position-field');
const position = document.getElementById('position');
const photoGuidance = document.getElementById('photo-guidance');
const applicationDetails = document.getElementById('application-details');
const modalityPrompt = document.getElementById('modality-prompt');
let previousModality = '';

applicationForm.addEventListener('reset', () => {
  previousModality = '';
  queueMicrotask(updateModality);
});

function updateModality() {
  const modality = applicationForm.elements.modalidad.value;
  const roles = positionsByModality[modality] || [];
  const remote = modality === 'Remoto';
  applicationDetails.hidden = !modality;
  applicationDetails.disabled = !modality;
  modalityPrompt.hidden = Boolean(modality);
  if (previousModality && modality && previousModality !== modality) {
    const photoInput = applicationForm.elements.foto;
    photoInput.value = '';
    photoInput.setCustomValidity('');
    photoInput.dispatchEvent(new Event('change', { bubbles: true }));
    photoInput.closest('.file-picker').querySelector('.picker-label').textContent = 'Subir';
  }
  previousModality = modality;
  position.replaceChildren(new Option('Selecciona tu puesto', ''), ...roles.map(role => new Option(role)));
  position.disabled = !modality;
  positionField.hidden = !modality;
  portfolioLink.setCustomValidity('');
  portfolioError.hidden = true;
  portfolioLink.removeAttribute('aria-invalid');
  photoGuidance.hidden = !modality;
  photoGuidance.textContent = 'No se aceptan fotos de DNI ni CV';
  document.getElementById('photo-title').textContent = remote ? 'Foto (rostro)' : 'Foto (cuerpo completo)';
  photoExampleToggle.hidden = !modality;
  if (!photoExample.hidden) photoExampleToggle.click();
  photoExample.classList.toggle('portrait', remote);
  const example = photoExample.querySelector('img');
  example.src = remote ? 'assets/foto-rostro-ejemplo.jpg?v=20261118-ia' : 'assets/foto-volantera-ejemplo.jpg?v=20261118-ia';
  example.alt = remote ? 'Ejemplo de foto de rostro' : 'Ejemplo de foto de cuerpo completo';
  example.width = remote ? 288 : 480;
  example.height = remote ? 360 : 720;
  document.getElementById('modality-error').hidden = true;
  document.getElementById('position-error').hidden = true;
}

modalityInputs.forEach(input => input.addEventListener('change', updateModality));

let availabilityTouched = false;

function updateAvailabilityValidation(showError = availabilityTouched) {
  const hasAvailability = availabilityInputs.some(input => input.checked);
  availabilityError.hidden = hasAvailability || !showError;
  availabilityInputs[0].setAttribute('aria-describedby', 'availability-error');
  return hasAvailability;
}

availabilityInputs.forEach(input => {
  input.addEventListener('change', () => {
    availabilityTouched = true;
    updateAvailabilityValidation();
  });
});

const rate = applicationForm.elements.tarifa_hora;
const rateDigits = /^[0-9]*$/;
let lastRateValue = rate.value;
function validateRate() {
  const valid = !rate.value || (Number.isSafeInteger(Number(rate.value)) && Number(rate.value) >= 10 && Number(rate.value) <= 100);
  rate.setCustomValidity(valid ? '' : fieldMessages.tarifa_hora);
  showFieldError(rate, valid ? '' : fieldMessages.tarifa_hora);
}
rate.addEventListener('beforeinput', event => {
  if (event.inputType !== 'insertText' || !event.data) return;
  const next = rate.value.slice(0, rate.selectionStart) + event.data + rate.value.slice(rate.selectionEnd);
  if (!rateDigits.test(event.data) || ((next.length > 3 || Number(next) > 100) && next.length >= rate.value.length)) event.preventDefault();
});
rate.addEventListener('input', () => {
  if (rateDigits.test(rate.value)) lastRateValue = rate.value;
  else rate.value = lastRateValue;
  // A single digit may still be the beginning of a valid amount.
  if (Number(rate.value) > 100 || document.activeElement !== rate) validateRate();
  else { rate.setCustomValidity(''); showFieldError(rate, ''); }
});
rate.addEventListener('blur', validateRate);
applicationForm.addEventListener('reset', () => {
  lastRateValue = rate.defaultValue;
  rate.setCustomValidity('');
});
applicationForm.addEventListener('submit', async event => {
  event.preventDefault();
  validateAdultAge();
  nationalityInput.setCustomValidity(nationalityPicker.selectedCode() ? '' : fieldMessages.nacionalidad);
  const ubigeo = selectedLocationCode();
  locationInput.setCustomValidity(ubigeo ? '' : fieldMessages.ubicacion);
  validatePortfolioLink();
  rate.setCustomValidity(!rate.value || (Number.isSafeInteger(Number(rate.value)) && Number(rate.value) >= 10 && Number(rate.value) <= 100) ? '' : fieldMessages.tarifa_hora);
  validateSocialLink();
  validatePresentation();
  let firstInvalid = null;
  for (const input of applicationForm.elements) {
    if (input === availabilityInputs[0] && !updateAvailabilityValidation(true)) firstInvalid ??= input;
    if (!input.willValidate || input.validity.valid) continue;
    firstInvalid ??= input;
    if (input.name === 'modalidad' || input === position) {
      const error = document.getElementById(input === position ? 'position-error' : 'modality-error');
      error.textContent = input === position ? 'Selecciona un puesto' : 'Selecciona una modalidad';
      error.hidden = false;
      continue;
    }
    if (input === portfolioLink || (birthParts.includes(input) && input.validity.customError)) continue;
    let message = fieldMessages[input.name] || input.validationMessage;
    if (!input.validity.valueMissing && (input.name === 'nombres' || input.name === 'apellidos')) {
      message = 'Usa entre 2 y 80 caracteres: letras, espacios o guiones';
    } else if (!input.validity.valueMissing && (input.name === 'birth_day' || input.name === 'birth_year')) {
      message = input.name === 'birth_day' ? 'Ingresa un día con uno o dos dígitos' : 'Ingresa un año de cuatro dígitos';
    }
    showFieldError(input, message);
  }
  if (firstInvalid) {
    firstInvalid.focus();
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
  status.textContent = 'Enviando tu postulación… No cierres ni recargues esta página hasta ver la confirmación';

  try {
    const payload = {
      id: submissionId,
      origin: location.origin,
      formStartedAt,
      form_note: applicationForm.elements.form_note.value,
      nombres: applicationForm.elements.nombres.value.trim(),
      apellidos: applicationForm.elements.apellidos.value.trim(),
      nacionalidad: nationalityPicker.selectedCode(),
      modalidad: applicationForm.elements.modalidad.value,
      puesto: position.value,
      fecha_nacimiento: applicationForm.elements.fecha_nacimiento.value,
      ubigeo,
      whatsapp: applicationForm.elements.whatsapp.value,
      portafolio: applicationForm.elements.portafolio.value.trim(),
      red_social: socialLink.value,
      tarifa_hora: Number(rate.value),
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
    status.textContent = `No pudimos confirmar si se recibió tu postulación. Puedes volver a intentarlo desde esta página. Código de intento: ${submissionId.slice(-8).toUpperCase()}`;
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
    if (!message || message.channel !== 'oficial-postulantes' || message.id !== requestId) return;
    completed = true;
    cleanup();
    if (message.ok) {
      submissionId = crypto.randomUUID();
      applicationForm.reset();
      socialLink.setCustomValidity('');
      birthParts.forEach(input => { input.setCustomValidity(''); input.removeAttribute('aria-invalid'); });
      birthDateError.hidden = true;
      portfolioLink.setCustomValidity('');
      portfolioError.hidden = true;
      portfolioLink.removeAttribute('aria-invalid');
      updateModality();
      document.querySelectorAll('.file-status').forEach(item => { item.textContent = ''; });
      availabilityTouched = false;
      updateAvailabilityValidation(false);
      status.textContent = 'Tu postulación fue recibida. Gracias por tu interés.';
      status.classList.add('success');
      status.hidden = false;
      status.scrollIntoView({ block: 'center', behavior: 'smooth' });
      submitButton.textContent = 'Postulación enviada';
    } else {
      const errorMessages = {
        INVALID_SUBMISSION: 'No pudimos validar algunos datos. Revisa la información e inténtalo de nuevo.',
        INVALID_FILE: 'Revisa el formato y el contenido de tu CV y de tu foto.',
        INVALID_REQUEST: 'No pudimos procesar los datos del formulario. Recarga la página e inténtalo de nuevo.',
        FORM_NOT_VERIFIED: 'No pudimos validar el envío. Recarga la página e inténtalo de nuevo.',
        SUBMISSION_TOO_FAST: 'Espera unos segundos y vuelve a enviar el formulario.',
        FORM_EXPIRED: 'El formulario estuvo abierto mucho tiempo. Recarga la página y vuelve a enviarlo.',
        INVALID_NAME: 'Revisa nombres y apellidos. Usa letras, espacios, guiones o apóstrofos.',
        INVALID_BIRTH_DATE: 'Revisa tu fecha de nacimiento.',
        INVALID_DISTRICT: 'Selecciona un distrito de la lista.',
        INVALID_MODALITY: 'Selecciona Remoto o Presencial.',
        INVALID_NATIONALITY: 'Selecciona tu nacionalidad de la lista.',
        APPLICATION_EXISTS: 'Ya tienes una postulación registrada en esta modalidad con este WhatsApp. Puedes postular a la otra modalidad.',
        INVALID_POSITION: 'Selecciona un puesto de la modalidad elegida.',
        INVALID_WHATSAPP: 'Revisa el celular: debe tener 9 dígitos y empezar con 9.',
        INVALID_SOCIAL_LINK: 'Revisa el enlace de tu red social.',
        INVALID_HOURLY_RATE: 'Ingresa una tarifa por hora entera entre S/10 y S/100.',
        INVALID_PORTFOLIO_LINK: 'Revisa el enlace de tu portafolio o déjalo vacío.',
        INVALID_PRESENTATION: 'Escribe una presentación de entre 40 y 300 caracteres.',
        AVAILABILITY_REQUIRED: 'Selecciona al menos un día y horario disponible.',
        INVALID_AVAILABILITY: 'No pudimos leer los horarios seleccionados. Vuelve a marcarlos.',
        REQUEST_MISSING: 'No se recibió el formulario completo. Recarga la página e inténtalo de nuevo.',
        CONSENT_REQUIRED: 'Debes aceptar la entrevista y la política de privacidad',
        UNDERAGE: 'Debes tener 18 años cumplidos para postular',
        CV_REQUIRED: 'Selecciona tu CV antes de enviar la postulación.',
        PHOTO_REQUIRED: 'Selecciona una foto antes de enviar la postulación.',
        INVALID_CV: 'El CV no es un PDF o DOCX válido. Revisa el archivo e inténtalo de nuevo.',
        INVALID_PHOTO: 'La foto no es JPG, JPEG, JFIF o PNG válida. Revisa el archivo e inténtalo de nuevo.',
        CV_TOO_LARGE: 'El CV supera el máximo de 2 MB.',
        PHOTO_TOO_LARGE: 'La foto supera el máximo de 2 MB.',
        REQUEST_TOO_LARGE: 'Los archivos superan el tamaño total permitido. Reduce su tamaño e inténtalo de nuevo.',
        BUSY: 'Estamos recibiendo varias postulaciones. Espera un momento e inténtalo de nuevo.',
        SHEET_NOT_READY: 'No pudimos guardar tu postulación en este momento. Inténtalo más tarde.',
        SHEET_HEADERS_MISMATCH: 'No pudimos guardar tu postulación en este momento. Inténtalo más tarde.',
        STORAGE_NOT_PRIVATE: 'No pudimos guardar tu postulación en este momento. Inténtalo más tarde.',
        RECORD_IDS_INVALID: 'No pudimos guardar tu postulación en este momento. Inténtalo más tarde.',
        ID_STATE_INVALID: 'No pudimos guardar tu postulación en este momento. Inténtalo más tarde.',
        SERVER_ERROR: 'Tuvimos un problema al procesar tu postulación. Puedes intentarlo otra vez; si vuelve a ocurrir, contáctanos con el código de seguimiento.'
      };
      const code = Object.hasOwn(errorMessages, message.code) ? message.code : 'UNKNOWN_ERROR';
      const reference = typeof message.reference === 'string' ? message.reference.slice(-8).toUpperCase() : '';
      const needsSupport = ['SHEET_NOT_READY', 'SHEET_HEADERS_MISMATCH', 'STORAGE_NOT_PRIVATE', 'RECORD_IDS_INVALID', 'ID_STATE_INVALID', 'SERVER_ERROR', 'UNKNOWN_ERROR'].includes(code);
      const referenceText = reference && needsSupport ? ` Código de seguimiento: ${reference}` : '';
      status.textContent = `${errorMessages[code] || 'No se pudo completar el envío. Inténtalo de nuevo y, si persiste, contáctanos.'}${referenceText}`;
      status.classList.add('error');
      submitButton.removeAttribute('aria-busy');
      submitButton.disabled = false;
      submitButton.textContent = 'Enviar postulación';
    }
  }

  window.addEventListener('message', onMessage);
  status.textContent = 'Enviando tu postulación… No cierres ni recargues esta página hasta ver la confirmación';
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
const privacyDialog = document.getElementById('privacy-dialog');
const privacyDialogClose = document.getElementById('privacy-dialog-close');
const privacyDialogX = document.getElementById('privacy-dialog-x');
privacyLink.addEventListener('click', event => {
  event.preventDefault();
  privacyDialog.showModal();
});
privacyDialogClose.addEventListener('click', () => privacyDialog.close());
privacyDialogX.addEventListener('click', () => privacyDialog.close());
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
  photoExampleToggle.textContent = photoExample.hidden ? 'Ver foto de ejemplo' : 'Ocultar foto de ejemplo';
});

position.addEventListener('change', () => { document.getElementById('position-error').hidden = true; });
updateModality();

const normalizeChoice = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

// Ambos buscadores comparten selección, teclado y posición flotante.
function setupChoicePicker(locationInput, locationOptions, locationEmpty, choices, minLength = 0, preferPeru = false) {
let activeLocation = -1;


function selectedLocationCode() {
  return choices.find(choice => choice.label === locationInput.value)?.code;
}

function closeLocationSuggestions() {
  activeLocation = -1;
  locationOptions.hidden = true;
  locationInput.setAttribute('aria-expanded', 'false');
  locationInput.removeAttribute('aria-activedescendant');
  locationEmpty.textContent = '';
}

function positionLocationSuggestions() {
  if (locationOptions.hidden && !locationEmpty.textContent) return;
  const field = locationInput.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const spaceBelow = bottom - field.bottom - 14;
  const spaceAbove = field.top - top - 14;
  const desiredHeight = locationOptions.hidden ? locationEmpty.offsetHeight : Math.min(248, locationOptions.scrollHeight + 2);
  const openAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
  const picker = locationInput.parentElement;
  picker.dataset.side = openAbove ? 'above' : 'below';
  picker.style.setProperty('--location-height', Math.max(0, Math.min(248, openAbove ? spaceAbove : spaceBelow)) + 'px');
}

function updateLocationSuggestions() {
  closeLocationSuggestions();
  const query = normalizeChoice(locationInput.value);
  if (query.length < minLength || (query && selectedLocationCode())) return;
  const matches = choices
    .filter(choice => choice.search.startsWith(query))
    .sort((first, second) => Number(second.search === query) - Number(first.search === query)
      || (!query && preferPeru ? Number(second.code === 'PE') - Number(first.code === 'PE') : 0)
      || first.label.localeCompare(second.label, 'es'))
    .slice(0, minLength ? 15 : choices.length);
  locationOptions.replaceChildren(...matches.map(({ code, label }) => {
    const row = document.createElement('li');
    row.id = locationOptions.id + '-' + code;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');
    row.textContent = label;
    return row;
  }));
  locationOptions.hidden = matches.length === 0;
  locationInput.setAttribute('aria-expanded', String(matches.length > 0));
  if (!matches.length) locationEmpty.textContent = 'No se encontraron resultados';
  positionLocationSuggestions();
}

function selectLocation(row) {
  locationInput.value = row.textContent;
  locationInput.dispatchEvent(new Event('input', { bubbles: true }));
  locationInput.focus();
}

locationInput.addEventListener('input', () => {
  locationInput.setCustomValidity('');
  updateLocationSuggestions();
});
window.addEventListener('resize', positionLocationSuggestions);
window.addEventListener('scroll', positionLocationSuggestions, { passive: true });
window.visualViewport?.addEventListener('resize', positionLocationSuggestions);
window.visualViewport?.addEventListener('scroll', positionLocationSuggestions);
locationInput.addEventListener('focus', updateLocationSuggestions);
locationInput.addEventListener('blur', closeLocationSuggestions);
locationOptions.addEventListener('mousedown', event => event.preventDefault());
locationOptions.addEventListener('click', event => {
  const row = event.target.closest('[role="option"]');
  if (row) selectLocation(row);
});
locationInput.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !locationOptions.hidden) {
    event.preventDefault();
    closeLocationSuggestions();
    return;
  }
  const direction = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (direction && locationOptions.hidden) updateLocationSuggestions();
  if (locationOptions.hidden) return;
  const rows = locationOptions.children;
  if (event.key === 'Enter' && activeLocation >= 0) {
    event.preventDefault();
    selectLocation(rows[activeLocation]);
  } else if (direction) {
    event.preventDefault();
    rows[activeLocation]?.setAttribute('aria-selected', 'false');
    activeLocation = activeLocation < 0 && direction < 0
      ? rows.length - 1 : (activeLocation + direction + rows.length) % rows.length;
    const row = rows[activeLocation];
    row.setAttribute('aria-selected', 'true');
    locationInput.setAttribute('aria-activedescendant', row.id);
    row.scrollIntoView({ block: 'nearest' });
  }
});
applicationForm.addEventListener('reset', () => {
  locationInput.setCustomValidity('');
  closeLocationSuggestions();
});

  return { selectedCode: selectedLocationCode };
}

const locationInput = applicationForm.elements.ubicacion;
const districtChoices = Object.entries(peruLocations).map(([code, parts]) => ({
  code, label: parts.join(', '), search: normalizeChoice(parts[0])
}));
const locationPicker = setupChoicePicker(locationInput, document.getElementById('location-options'),
  document.getElementById('location-empty'), districtChoices, 2);
function selectedLocationCode() { return locationPicker.selectedCode(); }

const countryChoices = [{"code":"AF","label":"Afganistán"},{"code":"AL","label":"Albania"},{"code":"DE","label":"Alemania"},{"code":"AD","label":"Andorra"},{"code":"AO","label":"Angola"},{"code":"AI","label":"Anguila"},{"code":"AQ","label":"Antártida"},{"code":"AG","label":"Antigua y Barbuda"},{"code":"SA","label":"Arabia Saudí"},{"code":"DZ","label":"Argelia"},{"code":"AR","label":"Argentina"},{"code":"AM","label":"Armenia"},{"code":"AW","label":"Aruba"},{"code":"AU","label":"Australia"},{"code":"AT","label":"Austria"},{"code":"AZ","label":"Azerbaiyán"},{"code":"BS","label":"Bahamas"},{"code":"BD","label":"Bangladés"},{"code":"BB","label":"Barbados"},{"code":"BH","label":"Baréin"},{"code":"BE","label":"Bélgica"},{"code":"BZ","label":"Belice"},{"code":"BJ","label":"Benín"},{"code":"BM","label":"Bermudas"},{"code":"BY","label":"Bielorrusia"},{"code":"BO","label":"Bolivia"},{"code":"BA","label":"Bosnia y Herzegovina"},{"code":"BW","label":"Botsuana"},{"code":"BR","label":"Brasil"},{"code":"BN","label":"Brunéi"},{"code":"BG","label":"Bulgaria"},{"code":"BF","label":"Burkina Faso"},{"code":"BI","label":"Burundi"},{"code":"BT","label":"Bután"},{"code":"CV","label":"Cabo Verde"},{"code":"KH","label":"Camboya"},{"code":"CM","label":"Camerún"},{"code":"CA","label":"Canadá"},{"code":"BQ","label":"Caribe neerlandés"},{"code":"QA","label":"Catar"},{"code":"TD","label":"Chad"},{"code":"CZ","label":"Chequia"},{"code":"CL","label":"Chile"},{"code":"CN","label":"China"},{"code":"CY","label":"Chipre"},{"code":"VA","label":"Ciudad del Vaticano"},{"code":"CO","label":"Colombia"},{"code":"KM","label":"Comoras"},{"code":"CG","label":"Congo"},{"code":"KP","label":"Corea del Norte"},{"code":"KR","label":"Corea del Sur"},{"code":"CR","label":"Costa Rica"},{"code":"CI","label":"Côte d’Ivoire"},{"code":"HR","label":"Croacia"},{"code":"CU","label":"Cuba"},{"code":"CW","label":"Curazao"},{"code":"DK","label":"Dinamarca"},{"code":"DM","label":"Dominica"},{"code":"EC","label":"Ecuador"},{"code":"EG","label":"Egipto"},{"code":"SV","label":"El Salvador"},{"code":"AE","label":"Emiratos Árabes Unidos"},{"code":"ER","label":"Eritrea"},{"code":"SK","label":"Eslovaquia"},{"code":"SI","label":"Eslovenia"},{"code":"ES","label":"España"},{"code":"US","label":"Estados Unidos"},{"code":"EE","label":"Estonia"},{"code":"SZ","label":"Esuatini"},{"code":"ET","label":"Etiopía"},{"code":"PH","label":"Filipinas"},{"code":"FI","label":"Finlandia"},{"code":"FJ","label":"Fiyi"},{"code":"FR","label":"Francia"},{"code":"GA","label":"Gabón"},{"code":"GM","label":"Gambia"},{"code":"GE","label":"Georgia"},{"code":"GH","label":"Ghana"},{"code":"GI","label":"Gibraltar"},{"code":"GD","label":"Granada"},{"code":"GR","label":"Grecia"},{"code":"GL","label":"Groenlandia"},{"code":"GP","label":"Guadalupe"},{"code":"GU","label":"Guam"},{"code":"GT","label":"Guatemala"},{"code":"GF","label":"Guayana Francesa"},{"code":"GG","label":"Guernesey"},{"code":"GN","label":"Guinea"},{"code":"GQ","label":"Guinea Ecuatorial"},{"code":"GW","label":"Guinea-Bisáu"},{"code":"GY","label":"Guyana"},{"code":"HT","label":"Haití"},{"code":"HN","label":"Honduras"},{"code":"HU","label":"Hungría"},{"code":"IN","label":"India"},{"code":"ID","label":"Indonesia"},{"code":"IQ","label":"Irak"},{"code":"IR","label":"Irán"},{"code":"IE","label":"Irlanda"},{"code":"BV","label":"Isla Bouvet"},{"code":"IM","label":"Isla de Man"},{"code":"CX","label":"Isla de Navidad"},{"code":"NF","label":"Isla Norfolk"},{"code":"IS","label":"Islandia"},{"code":"AX","label":"Islas Aland"},{"code":"KY","label":"Islas Caimán"},{"code":"CC","label":"Islas Cocos"},{"code":"CK","label":"Islas Cook"},{"code":"FO","label":"Islas Feroe"},{"code":"GS","label":"Islas Georgia del Sur y Sandwich del Sur"},{"code":"HM","label":"Islas Heard y McDonald"},{"code":"FK","label":"Islas Malvinas"},{"code":"MP","label":"Islas Marianas del Norte"},{"code":"MH","label":"Islas Marshall"},{"code":"UM","label":"Islas menores alejadas de EE. UU."},{"code":"PN","label":"Islas Pitcairn"},{"code":"SB","label":"Islas Salomón"},{"code":"TC","label":"Islas Turcas y Caicos"},{"code":"VG","label":"Islas Vírgenes Británicas"},{"code":"VI","label":"Islas Vírgenes de EE. UU."},{"code":"IL","label":"Israel"},{"code":"IT","label":"Italia"},{"code":"JM","label":"Jamaica"},{"code":"JP","label":"Japón"},{"code":"JE","label":"Jersey"},{"code":"JO","label":"Jordania"},{"code":"KZ","label":"Kazajistán"},{"code":"KE","label":"Kenia"},{"code":"KG","label":"Kirguistán"},{"code":"KI","label":"Kiribati"},{"code":"KW","label":"Kuwait"},{"code":"LA","label":"Laos"},{"code":"LS","label":"Lesoto"},{"code":"LV","label":"Letonia"},{"code":"LB","label":"Líbano"},{"code":"LR","label":"Liberia"},{"code":"LY","label":"Libia"},{"code":"LI","label":"Liechtenstein"},{"code":"LT","label":"Lituania"},{"code":"LU","label":"Luxemburgo"},{"code":"MK","label":"Macedonia del Norte"},{"code":"MG","label":"Madagascar"},{"code":"MY","label":"Malasia"},{"code":"MW","label":"Malaui"},{"code":"MV","label":"Maldivas"},{"code":"ML","label":"Mali"},{"code":"MT","label":"Malta"},{"code":"MA","label":"Marruecos"},{"code":"MQ","label":"Martinica"},{"code":"MU","label":"Mauricio"},{"code":"MR","label":"Mauritania"},{"code":"YT","label":"Mayotte"},{"code":"MX","label":"México"},{"code":"FM","label":"Micronesia"},{"code":"MD","label":"Moldavia"},{"code":"MC","label":"Mónaco"},{"code":"MN","label":"Mongolia"},{"code":"ME","label":"Montenegro"},{"code":"MS","label":"Montserrat"},{"code":"MZ","label":"Mozambique"},{"code":"MM","label":"Myanmar (Birmania)"},{"code":"NA","label":"Namibia"},{"code":"NR","label":"Nauru"},{"code":"NP","label":"Nepal"},{"code":"NI","label":"Nicaragua"},{"code":"NE","label":"Níger"},{"code":"NG","label":"Nigeria"},{"code":"NU","label":"Niue"},{"code":"NO","label":"Noruega"},{"code":"NC","label":"Nueva Caledonia"},{"code":"NZ","label":"Nueva Zelanda"},{"code":"OM","label":"Omán"},{"code":"NL","label":"Países Bajos"},{"code":"PK","label":"Pakistán"},{"code":"PW","label":"Palaos"},{"code":"PA","label":"Panamá"},{"code":"PG","label":"Papúa Nueva Guinea"},{"code":"PY","label":"Paraguay"},{"code":"PE","label":"Perú"},{"code":"PF","label":"Polinesia Francesa"},{"code":"PL","label":"Polonia"},{"code":"PT","label":"Portugal"},{"code":"PR","label":"Puerto Rico"},{"code":"HK","label":"RAE de Hong Kong (China)"},{"code":"MO","label":"RAE de Macao (China)"},{"code":"GB","label":"Reino Unido"},{"code":"CF","label":"República Centroafricana"},{"code":"CD","label":"República Democrática del Congo"},{"code":"DO","label":"República Dominicana"},{"code":"RE","label":"Reunión"},{"code":"RW","label":"Ruanda"},{"code":"RO","label":"Rumanía"},{"code":"RU","label":"Rusia"},{"code":"EH","label":"Sáhara Occidental"},{"code":"WS","label":"Samoa"},{"code":"AS","label":"Samoa Americana"},{"code":"BL","label":"San Bartolomé"},{"code":"KN","label":"San Cristóbal y Nieves"},{"code":"SM","label":"San Marino"},{"code":"MF","label":"San Martín"},{"code":"PM","label":"San Pedro y Miquelón"},{"code":"VC","label":"San Vicente y las Granadinas"},{"code":"SH","label":"Santa Elena"},{"code":"LC","label":"Santa Lucía"},{"code":"ST","label":"Santo Tomé y Príncipe"},{"code":"SN","label":"Senegal"},{"code":"RS","label":"Serbia"},{"code":"SC","label":"Seychelles"},{"code":"SL","label":"Sierra Leona"},{"code":"SG","label":"Singapur"},{"code":"SX","label":"Sint Maarten"},{"code":"SY","label":"Siria"},{"code":"SO","label":"Somalia"},{"code":"LK","label":"Sri Lanka"},{"code":"ZA","label":"Sudáfrica"},{"code":"SD","label":"Sudán"},{"code":"SS","label":"Sudán del Sur"},{"code":"SE","label":"Suecia"},{"code":"CH","label":"Suiza"},{"code":"SR","label":"Surinam"},{"code":"SJ","label":"Svalbard y Jan Mayen"},{"code":"TH","label":"Tailandia"},{"code":"TW","label":"Taiwán"},{"code":"TZ","label":"Tanzania"},{"code":"TJ","label":"Tayikistán"},{"code":"IO","label":"Territorio Británico del Océano Índico"},{"code":"TF","label":"Territorios Australes Franceses"},{"code":"PS","label":"Territorios Palestinos"},{"code":"TL","label":"Timor-Leste"},{"code":"TG","label":"Togo"},{"code":"TK","label":"Tokelau"},{"code":"TO","label":"Tonga"},{"code":"TT","label":"Trinidad y Tobago"},{"code":"TN","label":"Túnez"},{"code":"TM","label":"Turkmenistán"},{"code":"TR","label":"Turquía"},{"code":"TV","label":"Tuvalu"},{"code":"UA","label":"Ucrania"},{"code":"UG","label":"Uganda"},{"code":"UY","label":"Uruguay"},{"code":"UZ","label":"Uzbekistán"},{"code":"VU","label":"Vanuatu"},{"code":"VE","label":"Venezuela"},{"code":"VN","label":"Vietnam"},{"code":"WF","label":"Wallis y Futuna"},{"code":"YE","label":"Yemen"},{"code":"DJ","label":"Yibuti"},{"code":"ZM","label":"Zambia"},{"code":"ZW","label":"Zimbabue"}].map(choice => ({ ...choice, search: normalizeChoice(choice.label) }));
const nationalityInput = applicationForm.elements.nacionalidad;
const nationalityPicker = setupChoicePicker(nationalityInput, document.getElementById('nationality-options'),
  document.getElementById('nationality-empty'), countryChoices, 0, true);
