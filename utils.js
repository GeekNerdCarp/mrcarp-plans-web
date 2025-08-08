export const qs = (s, el=document)=>el.querySelector(s);
export const qsa = (s, el=document)=>[...el.querySelectorAll(s)];
export const fmtDate = (d)=>d.toISOString().slice(0,10);
export const todayYMD = ()=>fmtDate(new Date());
export const show = (el, on=true)=>el.classList[on?'add':'remove']('visible');
export const renderLinks = (text)=>{ const urlRe=/(https?:\/\/[^\s]+)/g; return (text||'').replace(urlRe, m=>`<a href="${m}" target="_blank" rel="noopener">${m}</a>`); };
