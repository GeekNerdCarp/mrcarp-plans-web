export const pb = new window.PocketBase(window.ENV_PB_URL || 'http://127.0.0.1:8090');
export const currentUser = ()=> pb.authStore.model;
export const isAuthed = ()=> pb.authStore.isValid;

// Classes
export const listClasses = async ()=> pb.collection('classes').getFullList({ sort:'name' });
export const addClass = async (name)=> pb.collection('classes').create({ name });
export const renameClass = async (id, name)=> pb.collection('classes').update(id, { name });
export const removeClass = async (id)=> pb.collection('classes').delete(id);
export const updateClassPeriods = async (id, periods)=> pb.collection('classes').update(id, { periods });

// Lessons
export const getLesson = async (class_id, date, period='')=>{
  const res = await pb.collection('lessons').getList(1,1,{ filter: pb.filter('class = {:c} && date = {:d} && period = {:p}', { c: class_id, d: date, p: period }) });
  return res.items[0] || null;
};
export const upsertLesson = async (payload)=>{
  const existing = await getLesson(payload.class, payload.date, payload.period||'');
  if (existing) return await pb.collection('lessons').update(existing.id, payload);
  return await pb.collection('lessons').create(payload);
};
export const deleteLesson = async (class_id, date, period='')=>{
  const existing = await getLesson(class_id, date, period);
  if (existing) await pb.collection('lessons').delete(existing.id);
};

// Notes
export const loadNotes = async ()=>{
  const res = await pb.collection('notes').getList(1,1,{ filter: pb.filter('user = {:u}', { u: currentUser().id }) });
  return res.items[0] || null;
};
export const saveNotes = async (content)=>{
  const existing = await loadNotes();
  if (existing) return await pb.collection('notes').update(existing.id, { content });
  return await pb.collection('notes').create({ content, user: currentUser().id });
};

// Terms, Templates
export const listTerms = async ()=> pb.collection('terms').getFullList({ sort:'start' });
export const addTerm = async (data)=> pb.collection('terms').create(data);
export const listTemplates = async (classId)=> pb.collection('templates').getFullList({ filter: pb.filter('class = {:c}', { c: classId }) });
export const saveTemplate = async (name, classId, body)=> pb.collection('templates').create({ name, class: classId, body });

// Ranges & files
export const listLessonsInRange = async (classId, start, end)=> pb.collection('lessons').getFullList({ filter: pb.filter('class = {:c} && date >= {:s} && date <= {:e}', { c: classId, s: start, e: end }), sort:'date' });
export const copyLessonToDates = async (lessonBody, dates)=>{ for(const d of dates){ await upsertLesson({ ...lessonBody, date:d }); } };
export const shiftLessons = async (classId, start, end, days)=>{
  const items = await listLessonsInRange(classId, start, end);
  for(const it of items){ const nd = new Date(it.date); nd.setDate(nd.getDate()+days); await upsertLesson({ ...it, id:undefined, date: nd.toISOString().slice(0,10) }); }
};
export const attachFiles = async (lessonId, fileList)=>{ if(!fileList?.length) return; const form = new FormData(); for(const f of fileList) form.append('files', f); await pb.collection('lessons').update(lessonId, form); };
