function parseBusinessSocial(network, raw) {
  const empty={network,user:'',url:'',error:''};
  let user=raw.trim();
  if(!user)return empty;
  if(/^(?:https?:\/\/|(?:www\.)?(?:instagram|facebook|tiktok)\.com\/)/i.test(user)){
    try{
      const link=new URL(/^https?:\/\//i.test(user)?user:'https://'+user);
      if(link.username||link.password||link.port)throw new Error();
      const host=link.hostname.replace(/^(?:www\.|m\.)/,'').toLowerCase();
      const names={'instagram.com':'instagram','facebook.com':'facebook','tiktok.com':'tiktok'};
      network=names[host];if(!network)throw new Error();
      const parts=link.pathname.split('/').filter(Boolean);
      if(network==='facebook'&&parts[0]==='profile.php')user=link.searchParams.get('id')||'';
      else{
        if(parts.length!==1)throw new Error();
        user=decodeURIComponent(parts[0]).replace(/^@/,'');
        if((network==='instagram'&&['p','reel','reels','stories','explore','accounts'].includes(user.toLowerCase()))||(network==='facebook'&&['watch','share','reel','groups','marketplace'].includes(user.toLowerCase())))throw new Error();
      }
    }catch{return {...empty,error:'Pega el enlace del perfil, no de una publicación'};}
  }
  user=user.replace(/^@+/,'');
  if(!/^[a-zA-Z0-9._]{1,100}$/.test(user))return {...empty,error:'Usa el usuario del perfil, sin espacios ni símbolos adicionales'};
  const bases={instagram:'https://www.instagram.com/',facebook:'https://www.facebook.com/',tiktok:'https://www.tiktok.com/@'};
  if(!bases[network])return {...empty,error:'Selecciona una red social'};
  const url=network==='facebook'&&/^\d+$/.test(user)?bases.facebook+'profile.php?id='+user:bases[network]+user;
  return {network,user,url,error:''};
}
