import { qs, qsa, todayYMD } from './utils.js';
import { pb, currentUser, isAuthed, listClasses, addClass, renameClass, removeClass, updateClassPeriods, getLesson, upsertLesson, deleteLesson, loadNotes, saveNotes, listTerms, addTerm, listTemplates, saveTemplate, listLessonsInRange, copyLessonToDates, shiftLessons, attachFiles } from './db.js';
import { buildCalendar } from './calendar.js';

// ====== ENV ======
// app.js
window.ENV_PB_URL = "https://mrcarp-plans-pb.fly.dev"; // replace after Fly deploy;
// ==================

const isAuthPage = location.pathname.endsWith('index.html') || location.pathname.endsWith('/') || !location.pathname.includes('.html');

if (isAuthPage){
  // Tabs
  const tabs = qsa('.tab');
  tabs.forEach(t=>t.addEventListener('click',()=>{
    tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active');
    qs('#signin').classList.toggle('visible', t.dataset.view==='signin');
    qs('#signup').classList.toggle('visible', t.dataset.view==='signup');
  }));

  // Sign in
  qs('#signin').addEventListener('submit', async (e)=>{
    e.preventDefault();
    try{ await pb.collection('users').authWithPassword(qs('#si-email').value.trim(), qs('#si-password').value); location.href='dashboard.html'; }
    catch(err){ qs('#auth-error').textContent = err?.message || 'Sign in failed'; }
  });

  // Sign up
  qs('#signup').addEventListener('submit', async (e)=>{
    e.preventDefault();
    try{ const email = qs('#su-email').value.trim(); const password = qs('#su-password').value; await pb.collection('users').create({ email, password, passwordConfirm: password }); alert('Account created. You can now sign in.'); }
    catch(err){ qs('#auth-error').textContent = err?.message || 'Sign up failed'; }
  });
}
else{
  // ===== Dashboard =====
  if (!isAuthed()) { location.href = 'index.html'; }
  qs('#user-email').textContent = currentUser()?.email || '';

  const root = document.documentElement; const themeBtn = qs('#theme-toggle');
  if (themeBtn){ themeBtn.onclick = ()=>{ root.classList.toggle('light'); localStorage.setItem('theme', root.classList.contains('light')?'light':'dark'); }; const saved=localStorage.getItem('theme'); if(saved==='light') root.classList.add('light'); }
  qs('#print-view').onclick = ()=> window.print();

  let currentDate = new Date();
  let activeDate = todayYMD();

  init();

  async function init(){
    // Calendar
    buildCalendar(qs('#calendar'), currentDate);
    selectDate(activeDate);
    wireCalendar();
    qs('#prev-month').onclick = ()=>{ currentDate.setMonth(currentDate.getMonth()-1); buildCalendar(qs('#calendar'), currentDate); wireCalendar(); };
    qs('#next-month').onclick = ()=>{ currentDate.setMonth(currentDate.getMonth()+1); buildCalendar(qs('#calendar'), currentDate); wireCalendar(); };

    // Terms
    await refreshTerms();

    // Classes
    await refreshClasses();
    qs('#add-class').onclick = async ()=>{ const name = prompt('Class name:'); if(!name) return; await addClass(name); await refreshClasses(); await refreshClassSelect(); };

    // Notes
    const existing = await loadNotes(); if (existing) qs('#general-notes').value = existing.content || '';
    qs('#save-notes').onclick = async ()=>{ await saveNotes(qs('#general-notes').value); flash('#notes-status','Notes saved.'); };

    // Lesson actions
    qs('#save-lesson').onclick = saveLesson;
    qs('#delete-lesson').onclick = deleteCurrentLesson;
    qs('#copy-to-dates').onclick = copyToDates;
    qs('#shift-range').onclick = shiftRange;

    // Sign out
    qs('#signout').onclick = ()=>{ pb.authStore.clear(); location.href='index.html'; };
  }

  function wireCalendar(){ qsa('.calendar .cell').forEach(cell=> cell.addEventListener('click', ()=> selectDate(cell.dataset.date))); }
  function selectDate(ymd){ activeDate = ymd; qs('#selected-date-label').textContent = ymd; qsa('.calendar .cell').forEach(c=>c.classList.toggle('active', c.dataset.date===ymd)); loadCurrentLesson(); }

  async function refreshTerms(){
    const terms = await listTerms();
    for(const id of ['term-select','term-select-top']){
      const sel = qs(`#${id}`); if(!sel) continue; sel.innerHTML='';
      for(const t of terms){ const o=document.createElement('option'); o.value=t.id; o.textContent=`${t.name} (${t.start.slice(0,10)}–${t.end.slice(0,10)})`; o.dataset.start=t.start.slice(0,10); o.dataset.end=t.end.slice(0,10); sel.appendChild(o); }
    }
    qs('#add-term').onclick = async ()=>{
      const name = prompt('Term name (e.g., 2025 Fall):'); if(!name) return;
      const start = prompt('Start date (YYYY-MM-DD):'); if(!start) return;
      const end   = prompt('End date (YYYY-MM-DD):'); if(!end) return;
      await addTerm({ name, start, end }); await refreshTerms();
    };
  }

  let classes=[];
  async function refreshClasses(){ classes = await listClasses(); const list = qs('#class-list'); list.innerHTML=''; const tpl = qs('#class-item'); for(const c of classes){ const li=tpl.content.firstElementChild.cloneNode(true); li.dataset.id=c.id; li.querySelector('.name').textContent=c.name; li.querySelector('.rename').onclick=async()=>{ const name=prompt('New name:', c.name); if(!name) return; await renameClass(c.id, name); await refreshClasses(); await refreshClassSelect(); }; li.querySelector('.remove').onclick=async()=>{ if(!confirm('Delete class and its lessons?')) return; await removeClass(c.id); await refreshClasses(); await refreshClassSelect(); }; list.appendChild(li); } await refreshClassSelect(); }

  async function refreshClassSelect(){ const sel = qs('#lesson-class'); sel.innerHTML=''; for(const c of classes){ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; sel.appendChild(o);} await refreshPeriods(); await loadTemplates(); await loadCurrentLesson(); }

  async function refreshPeriods(){ const classId = qs('#lesson-class').value; if(!classId) return; const cls = await pb.collection('classes').getOne(classId); const sel=qs('#period-select'); sel.innerHTML=''; (cls.periods||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p.name; o.textContent=`${p.name} (${p.start}–${p.end})`; sel.appendChild(o);}); }
  qs('#edit-periods').addEventListener('click', async ()=>{ const classId=qs('#lesson-class').value; if(!classId) return; const current=(await pb.collection('classes').getOne(classId)).periods||[]; const sample=current.length?current:[{name:'1st',start:'08:00',end:'08:50'}]; const input=prompt('Edit periods as JSON array (name,start,end):', JSON.stringify(sample,null,2)); if(!input) return; const periods=JSON.parse(input); await updateClassPeriods(classId, periods); await refreshPeriods(); alert('Periods updated.'); });

  async function loadTemplates(){ const classId=qs('#lesson-class').value; const list=await listTemplates(classId); const sel=qs('#template-select'); sel.innerHTML=''; for(const t of list){ const o=document.createElement('option'); o.value=t.id; o.textContent=t.name; sel.appendChild(o);} qs('#save-template').onclick=async()=>{ const name=prompt('Template name:'); if(!name) return; const body=currentLessonBody(); await saveTemplate(name, classId, body); await loadTemplates(); }; qs('#apply-template').onclick=async()=>{ const id=sel.value; if(!id) return; const t=await pb.collection('templates').getOne(id); setLessonBody(t.body||{}); } }

  function currentLessonBody(){ return { class: qs('#lesson-class').value, period: qs('#period-select').value||'', objectives: qs('#lesson-objectives').value, activities: qs('#lesson-activities').value, resources: qs('#lesson-resources').value, assignment: qs('#lesson-assignment').value, homework: qs('#lesson-homework').value, assessments: qs('#lesson-assessments').value }; }
  function setLessonBody(b){ qs('#lesson-objectives').value=b.objectives||''; qs('#lesson-activities').value=b.activities||''; qs('#lesson-resources').value=b.resources||''; qs('#lesson-assignment').value=b.assignment||''; qs('#lesson-homework').value=b.homework||''; qs('#lesson-assessments').value=b.assessments||''; if (b.period){ const sel=qs('#period-select'); const opt=[...sel.options].find(o=>o.value===b.period); if(opt) sel.value=b.period; } }

  async function loadCurrentLesson(){ const class_id = qs('#lesson-class').value; if(!class_id || !activeDate) return; const lesson = await getLesson(class_id, activeDate, qs('#period-select').value||''); setLessonBody(lesson||{}); renderFiles(lesson); }

  async function saveLesson(){ const class_id = qs('#lesson-class').value; const payload = { ...currentLessonBody(), class: class_id, date: activeDate }; const saved = await upsertLesson(payload); await attachFiles(saved.id, qs('#lesson-files').files); flash('#lesson-status','Lesson saved.'); await loadCurrentLesson(); }

  async function deleteCurrentLesson(){ const class_id = qs('#lesson-class').value; if (!confirm('Delete this lesson?')) return; await deleteLesson(class_id, activeDate, qs('#period-select').value||''); setLessonBody({}); flash('#lesson-status','Lesson deleted.'); }

  async function copyToDates(){ const raw = prompt('Enter comma-separated dates (YYYY-MM-DD):'); if(!raw) return; const dates = raw.split(',').map(s=>s.trim()); const body = currentLessonBody(); await copyLessonToDates(body, dates); alert('Copied.'); }
  async function shiftRange(){ const classId = qs('#lesson-class').value; const start = prompt('Range start (YYYY-MM-DD):'); if(!start) return; const end = prompt('Range end (YYYY-MM-DD):'); if(!end) return; const days = parseInt(prompt('Shift by how many days? (e.g. 5 or -5)'),10); if(!days) return; await shiftLessons(classId, start, end, days); alert('Shifted.'); }

  function flash(sel,msg){ const n=qs(sel); n.textContent=msg; setTimeout(()=>n.textContent='', 2000); }

  function renderFiles(lesson){ const list = qs('#file-list'); list.innerHTML=''; if(!lesson?.files?.length) return; (lesson.files||[]).forEach(f=>{ const a=document.createElement('a'); a.href = pb.files.getUrl(lesson,f); a.textContent=f; a.target='_blank'; list.appendChild(a); list.appendChild(document.createElement('br')); }); }
}
