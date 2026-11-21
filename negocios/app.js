(() => {
'use strict';
const endpoint='https://script.google.com/macros/s/AKfycbx2-xg2xNhO01ddjZ9OvrD0bnsBI7TA1nT-g9shKtmUF-TOAZvCsonvbLQO4Tpstj0/exec';
let sending=false,requestId=crypto.randomUUID(),lastPayload='';
function trustedFrameSource(source,frame){try{for(let i=0;source&&i<10;i++){if(source===frame)return true;if(source===source.parent)return false;source=source.parent;}}catch{}return false;}
function sendBusiness(payload){
 return new Promise((resolve,reject)=>{
  const frame=document.createElement('iframe');frame.hidden=true;frame.name='business-'+payload.id;frame.title='Respuesta de registro';document.body.append(frame);
  const outbound=document.createElement('form');outbound.method='POST';outbound.action=endpoint;outbound.target=frame.name;outbound.hidden=true;
  const input=document.createElement('input');input.type='hidden';input.name='payload';input.value=JSON.stringify(payload);outbound.append(input);document.body.append(outbound);
  let finished=false;
  const timeout=setTimeout(()=>{if(finished)return;finished=true;cleanup();reject(new Error('No pudimos confirmar la recepción. Tus datos se conservan; puedes reintentar sin cambiarlos.'));},30000);
  function cleanup(){clearTimeout(timeout);window.removeEventListener('message',receive);outbound.remove();frame.remove();}
  function receive(event){
   if(!(/^https:\/\/(?:script\.google\.com|(?:[a-z0-9-]+-)?script\.googleusercontent\.com)$/.test(event.origin))||!trustedFrameSource(event.source,frame.contentWindow))return;
   const message=event.data;if(!message||message.channel!=='oficial-negocios'||message.id!==payload.id)return;
   finished=true;cleanup();resolve(message);
  }
  window.addEventListener('message',receive);
  try{outbound.submit();}catch(error){finished=true;cleanup();reject(error);}
 });
}

const form=document.getElementById('business-form');
const editor=document.getElementById('location-editor'),summary=document.getElementById('location-summary'),details=document.getElementById('business-details');
const placeType=document.getElementById('tipo-lugar'),placeName=document.getElementById('lugar'),locationError=document.getElementById('location-error');
const repeatStorageKey='oficial-negocios-ubicacion-v1';
const repeatNames=['piso','seccion','pasillo'];
const storageKey='oficial-negocios-lugar-v1',allowed=['Mercado','Galería','Centro comercial','Feria'];
let active=null;
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&allowed.includes(saved.type)&&typeof saved.name==='string'&&saved.name.trim()&&saved.name.length<=160)active=saved;}catch{}
function markRepeated(name, show){document.getElementById('prefilled-'+name).hidden=!show;}
function persistRepeated(){
 if(!active)return;
 const values=Object.fromEntries(repeatNames.map(name=>[name,form.elements[name].value]));
 try{localStorage.setItem(repeatStorageKey,JSON.stringify({place:active,values}));}catch{}
}
function restoreRepeated(){
 try{
  const saved=JSON.parse(localStorage.getItem(repeatStorageKey));
  if(!active||!saved||saved.place?.type!==active.type||saved.place?.name!==active.name)return;
  repeatNames.forEach(name=>{const input=form.elements[name],value=saved.values?.[name];if(typeof value==='string'&&value.length<=input.maxLength){input.value=value;markRepeated(name,!!value);}});
 }catch{}
}
repeatNames.forEach(name=>form.elements[name].addEventListener('input',()=>{markRepeated(name,false);persistRepeated();}));
function render(){editor.hidden=!!active;summary.hidden=!active;details.hidden=!active;details.disabled=!active;document.getElementById('location-prompt').hidden=!!active;if(active)document.getElementById('location-display').textContent=active.type+' · '+active.name;}
function fieldError(input,message){input.setCustomValidity(message);input.toggleAttribute('aria-invalid',!!message);const id='error-'+input.name;let node=document.getElementById(id);if(!node){node=document.createElement('small');node.id=id;node.className='field-error';input.closest('label').append(node);input.setAttribute('aria-describedby',id);}node.textContent=message;node.hidden=!message;}
document.getElementById('save-location').onclick=()=>{const name=placeName.value.trim().replace(/\s+/g,' ');if(!allowed.includes(placeType.value)||businessFieldMessage('lugar',placeName.value)){locationError.textContent=!allowed.includes(placeType.value)?'Selecciona el tipo de lugar':businessFieldMessage('lugar',placeName.value);locationError.hidden=false;(!placeType.value?placeType:placeName).focus();return;}const changed=active&&(active.type!==placeType.value||active.name!==name);active={type:placeType.value,name};try{localStorage.setItem(storageKey,JSON.stringify(active));}catch{}if(changed){repeatNames.forEach(key=>{form.elements[key].value='';markRepeated(key,false);fieldError(form.elements[key],'');});persistRepeated();}locationError.hidden=true;render();};
document.getElementById('change-location').onclick=()=>{placeType.value=active.type;placeName.value=active.name;editor.hidden=false;summary.hidden=true;details.disabled=true;document.getElementById('cancel-location').hidden=false;placeType.focus();};
document.getElementById('cancel-location').onclick=()=>{locationError.hidden=true;render();};
const phone=form.elements.whatsapp;
phone.addEventListener('beforeinput',e=>{if(e.inputType!=='insertText'||!e.data)return;const next=phone.value.slice(0,phone.selectionStart)+e.data+phone.value.slice(phone.selectionEnd);if(/\D/.test(e.data)||next.replace(/\D/g,'').length>9)e.preventDefault();});
phone.addEventListener('paste',e=>{e.preventDefault();const text=e.clipboardData.getData('text').trim().replace(/^(?:\+51|0051)\s*/,'');phone.setRangeText(/^[\d\s().-]+$/.test(text)?text.replace(/\D/g,''):text,phone.selectionStart,phone.selectionEnd,'end');phone.dispatchEvent(new Event('input',{bubbles:true}));});
function validatePhone(final=false){const raw=phone.value;const digits=raw.replace(/ /g,'');if(/^[\d ]*$/.test(raw)&&digits.length<=9)phone.value=digits.replace(/(\d{3})(?=\d)/g,'$1 ');const invalid=raw&&(!/^[\d ]+$/.test(raw)||digits.length>9||(final&&(!/^9\d{8}$/.test(digits)))||(digits.length===9&&!digits.startsWith('9')));fieldError(phone,invalid?'Ingresa un celular peruano de 9 dígitos que empiece en 9':'');}
phone.addEventListener('input',()=>validatePhone());phone.addEventListener('blur',()=>validatePhone(true));
const social=form.elements.red_social;
function validateSocial(){const text=social.value.trim();let candidate=text;if(text&&!/^https?:\/\//i.test(text))candidate='https://'+text;let valid=!text;try{const u=new URL(candidate);valid=businessSocialValid(candidate)&&!u.username&&!u.password;}catch{}if(valid)social.value=text?candidate:'';fieldError(social,valid?'':'Ingresa un enlace válido al perfil del negocio');}
social.addEventListener('blur',validateSocial);social.addEventListener('input',()=>fieldError(social,''));
form.addEventListener('submit',async e=>{
 e.preventDefault();if(sending||!active||!editor.hidden)return;
 validatePhone(true);validateSocial();let first=null;
 for(const input of form.elements){if(!input.name||input.disabled||[phone,social].includes(input))continue;if(input.type==='text')input.value=input.value.trim().replace(/\s+/g,' ');fieldError(input,businessFieldMessage(input.name,input.value));if(!input.validity.valid)first??=input;}
 if(!phone.validity.valid)first??=phone;if(!social.validity.valid)first??=social;if(first){first.focus();return;}
 const values=Object.fromEntries([...form.elements].filter(input=>input.name&&!input.disabled).map(input=>[input.name,input.value]));
 if(businessFieldMessage('lugar',active.name)){document.getElementById('change-location').click();return;}
 const fields={...values,tipo_lugar:active.type,lugar:active.name};
 const signature=JSON.stringify(fields);if(lastPayload&&lastPayload!==signature)requestId=crypto.randomUUID();lastPayload=signature;
 const payload={...fields,id:requestId,origin:location.origin,form_note:''};
 const retained=repeatNames.map(k=>form.elements[k].value);
 const status=document.getElementById('form-status'),button=form.querySelector('[type=submit]');
 const locationButtons=[...document.querySelectorAll('#save-location,#change-location,#cancel-location')];
 sending=true;details.disabled=true;locationButtons.forEach(b=>b.disabled=true);button.textContent='Enviando…';
 status.classList.remove('success','error');status.hidden=false;status.textContent='Enviando el registro… No cierres ni recargues esta página hasta ver la confirmación';
 try{
  const result=await sendBusiness(payload);
  if(!result.ok){
   const messages={BUSINESS_EXISTS:'Ya existe un registro con el mismo piso y local en este lugar. Revisa los datos antes de continuar.',INVALID_FIELDS:'Revisa los campos obligatorios y sus límites.',INVALID_WHATSAPP:'Revisa el WhatsApp: debe tener 9 dígitos y empezar en 9.',INVALID_SOCIAL_LINK:'Revisa el enlace de la red social.',BUSY:'Hay otro registro en curso. Espera un momento y vuelve a intentarlo.',SHEET_HEADERS_MISMATCH:'No se pudo guardar: revisa los encabezados de la hoja.',INVALID_ORIGIN:'Esta dirección del formulario no está autorizada.',REQUEST_CHANGED:'Los datos cambiaron durante un reintento. Revisa el registro.'};
   throw new Error(messages[result.code]||'No se pudo guardar el registro. Conservamos tus datos para reintentar.');
  }
  requestId=crypto.randomUUID();lastPayload='';form.reset();repeatNames.forEach((k,i)=>{form.elements[k].value=retained[i];markRepeated(k,!!retained[i]);});persistRepeated();
  document.querySelectorAll('.field-error').forEach(n=>n.hidden=true);
  status.classList.add('success');status.textContent='Registro guardado. ID: '+result.recordId;
 }catch(error){status.classList.add('error');status.textContent=error.message;}
 finally{sending=false;render();locationButtons.forEach(b=>b.disabled=false);button.textContent='Guardar registro';status.hidden=false;status.scrollIntoView({block:'nearest'});}
});
const auditedInputs=[placeName,...['piso','seccion','pasillo','tipo','nombre','local'].map(name=>form.elements[name])];
auditedInputs.forEach(input=>{
 const name=input===placeName?'lugar':input.name;
 input.addEventListener('beforeinput',event=>{
  if(event.inputType!=='insertText'||!event.data)return;
  const allowedChars=name==='piso'?/^[0-9]+$/:name==='local'||name==='pasillo'?/^[\p{L}\p{N} .\/-]+$/u:/^[\p{L}\p{M}\p{N} &'’.,()/+#°º-]+$/u;
  if(!allowedChars.test(event.data))event.preventDefault();
 });
 input.addEventListener('paste',event=>{
  event.preventDefault();const text=event.clipboardData.getData('text');
  input.setRangeText(text,input.selectionStart,input.selectionEnd,'end');input.dispatchEvent(new Event('input',{bubbles:true}));
  if(input===placeName){locationError.textContent=businessFieldMessage(name,input.value);locationError.hidden=!locationError.textContent;}
  else fieldError(input,businessFieldMessage(name,input.value));
 });
 input.addEventListener('blur',()=>{
  const message=businessFieldMessage(name,input.value);
  if(input===placeName){locationError.textContent=message;locationError.hidden=!message;}
  else fieldError(input,message);
  if(!message)input.value=input.value.trim().replace(/\s+/g,' ');
 });
});
render();
restoreRepeated();
form.addEventListener('input',event=>{const input=event.target;if(input.name&&![phone,social].includes(input))fieldError(input,'');document.getElementById('form-status').hidden=true;});
})();
