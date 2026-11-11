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
const submissionId = crypto.randomUUID();

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
  input.setAttribute('aria-describedby', status.id);
  const pickerLabel = input.closest('.file-picker').querySelector('.picker-label');
  let selection = 0;
  input.form.addEventListener('reset', () => {
    selection++;
    pickerLabel.textContent = 'Subir';
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
whatsapp.addEventListener('input', () => {
  const before = whatsapp.value;
  const caret = whatsapp.selectionStart ?? before.length;
  const digitsBeforeCaret = before.slice(0, caret).replace(/\D/g, '').length;
  let raw = before.trim().replace(/^(?:\+51|0051)/, '');
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 9 || /[^\d\s().-]/.test(raw)) return;
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

const portfolioLink = document.querySelector('[name="portafolio"]');
const portfolioError = document.getElementById('portfolio-error');
function validatePortfolioLink() {
  const value = portfolioLink.value.trim();
  portfolioLink.value = value;
  const valid = !value || (value.length <= 2048 && /^https?:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value));
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
portfolioLink.addEventListener('blur', () => {
  const value = portfolioLink.value.trim();
  if (value && !/^https?:\/\//i.test(value)) portfolioLink.value = `https://${value}`;
  validatePortfolioLink();
});

const presentation = document.querySelector('[name="presentacion"]');
presentation.addEventListener('input', () => {
  presentation.setCustomValidity(presentation.value.trim() ? '' : 'Escribe una breve presentación.');
});

const applicationForm = document.getElementById('application-form');
const availabilityInputs = [...document.querySelectorAll('[name="horarios_disponibles"]')];
const availabilityError = document.getElementById('availability-error');
const positionInputs = [...document.querySelectorAll('[name="puesto"]')];
const positionError = document.getElementById('position-error');
const fieldMessages = {
  cv: 'Selecciona tu CV',
  foto: 'Selecciona tu foto',
  nombres: 'Ingresa tus nombres',
  apellidos: 'Ingresa tus apellidos',
  birth_day: 'Ingresa el día de nacimiento',
  birth_month: 'Selecciona el mes de nacimiento',
  birth_year: 'Ingresa el año de nacimiento',
  distrito: 'Selecciona tu distrito',
  whatsapp: 'Ingresa un celular peruano de 9 dígitos que empiece en 9',
  presentacion: 'Escribe una breve presentación',
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
    else input.closest('label').append(error);
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
  if (document.getElementById(input.name + '-validation-error')) showFieldError(input, '');
}

applicationForm.addEventListener('input', clearFieldError);
applicationForm.addEventListener('change', clearFieldError);
applicationForm.noValidate = true;

let positionTouched = false;

function updatePositionValidation(showError = positionTouched) {
  const hasPosition = positionInputs.some(input => input.checked);
  positionError.hidden = hasPosition || !showError;
  positionInputs[0].setAttribute('aria-describedby', 'position-hint position-error');
  return hasPosition;
}

positionInputs.forEach(input => {
  input.addEventListener('change', () => {
    positionTouched = true;
    updatePositionValidation();
  });
});
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

applicationForm.addEventListener('submit', async event => {
  event.preventDefault();
  validateAdultAge();
  validatePortfolioLink();
  presentation.setCustomValidity(presentation.value.trim() ? '' : 'Escribe una breve presentación');
  let firstInvalid = null;
  for (const input of applicationForm.elements) {
    if (input === positionInputs[0] && !updatePositionValidation(true)) firstInvalid ??= input;
    if (input === availabilityInputs[0] && !updateAvailabilityValidation(true)) firstInvalid ??= input;
    if (!input.willValidate || input.validity.valid) continue;
    firstInvalid ??= input;
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
  status.textContent = 'Enviando tu postulación…';

  try {
    const payload = {
      id: submissionId,
      origin: location.origin,
      formStartedAt,
      form_note: applicationForm.elements.form_note.value,
      nombres: applicationForm.elements.nombres.value.trim(),
      apellidos: applicationForm.elements.apellidos.value.trim(),
      puesto: positionInputs.filter(input => input.checked).map(input => input.value),
      fecha_nacimiento: applicationForm.elements.fecha_nacimiento.value,
      distrito: applicationForm.elements.distrito.value,
      whatsapp: applicationForm.elements.whatsapp.value,
      portafolio: applicationForm.elements.portafolio.value.trim(),
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
    if (!message || message.channel !== 'oficial-btl' || message.id !== requestId) return;
    completed = true;
    cleanup();
    if (message.ok) {
      applicationForm.reset();
      birthParts.forEach(input => { input.setCustomValidity(''); input.removeAttribute('aria-invalid'); });
      birthDateError.hidden = true;
      portfolioLink.setCustomValidity('');
      portfolioError.hidden = true;
      portfolioLink.removeAttribute('aria-invalid');
      positionTouched = false;
      updatePositionValidation(false);
      document.querySelectorAll('.file-status').forEach(item => { item.textContent = ''; });
      availabilityTouched = false;
      updateAvailabilityValidation(false);
      status.textContent = 'Tu postulación fue recibida. Gracias por tu interés.';
      status.classList.add('success');
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
        INVALID_POSITION: 'Selecciona al menos un puesto de interés.',
        INVALID_WHATSAPP: 'Revisa el celular: debe tener 9 dígitos y empezar con 9.',
        INVALID_PORTFOLIO_LINK: 'Revisa el enlace de tu portafolio o déjalo vacío.',
        INVALID_PRESENTATION: 'Completa tu presentación con un máximo de 300 caracteres.',
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
