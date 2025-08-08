import { qs } from './utils.js';

export function buildCalendar(container, current){
  container.innerHTML = '';
  const title = qs('#calendar-title');
  const year = current.getFullYear();
  const month = current.getMonth();
  title.textContent = current.toLocaleString(undefined,{ month:'long', year:'numeric'});

  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  dow.forEach(d=>{ const el=document.createElement('div'); el.textContent=d; el.className='dow'; container.appendChild(el); });

  const first = new Date(year, month, 1);
  const pad = first.getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  for (let i=0;i<pad;i++) container.appendChild(document.createElement('div'));
  for (let day=1; day<=daysInMonth; day++){
    const cell = document.createElement('button');
    cell.className = 'cell';
    const num = document.createElement('div'); num.className='num'; num.textContent = day; cell.appendChild(num);
    cell.dataset.date = new Date(year, month, day).toISOString().slice(0,10);
    container.appendChild(cell);
  }
}
