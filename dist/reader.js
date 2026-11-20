import temml from './vendor/temml.js';

// Reading views use DOM text nodes throughout so uploaded notes stay inert.
const glyphs = {
  bookmark: '<path d="M6.5 4.5h11v15l-5.5-3.6-5.5 3.6z"/>',
  book: '<path d="M3 5.6c3-1.2 6.2-.7 9 1.3 2.8-2 6-2.5 9-1.3v13c-3-1.2-6.2-.7-9 1.3-2.8-2-6-2.5-9-1.3zM12 7v12"/>',
  file: '<path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15.5h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.3"/><path d="m15 15 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  check: '<path d="m5 12 4.4 4.4L19 7"/>',
  correction: '<path d="m5 15 9.5-9.5 3 3L8 18l-4 1zM13 7l3 3"/>',
  branch: '<path d="M7 5v14M7 14c5 0 9-1 9-7"/><circle cx="7" cy="4" r="2"/><circle cx="7" cy="20" r="2"/><circle cx="16" cy="5" r="2"/>',
  recall: '<path d="M8 8.2a4 4 0 0 1 8 .6c0 2.8-4 3.2-4 6M12 18h.01"/>',
};

function icon(name, size = 18) {
  const holder = document.createElement('span');
  holder.className = 'rw-icon';
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${glyphs[name] || ''}</svg>`;
  return holder;
}
function el(tag, cls, value) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (value !== undefined && value !== null) node.textContent = String(value);
  return node;
}
function button(label, className, action) {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', action);
  return b;
}
function surface(ctx, name) {
  const root = el('div', 'rw rw-' + name);
  ctx.main.replaceChildren(root);
  return root;
}
function singular(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
function courseFor(state, note) {
  return state.courses.find(c => c.id === note.courseId);
}
function crumb(ctx, root, parts) {
  const nav = el('nav', 'rw-crumb');
  nav.setAttribute('aria-label', 'Breadcrumb');
  parts.forEach(({label, page, id}, i) => {
    if (i) nav.append(icon('chevron', 12));
    if (page) nav.append(button(label, 'rw-textbutton', () => ctx.navigate(page,id)));
    else {
      const current = el('span', '', label);
      current.setAttribute('aria-current', 'page');
      nav.append(current);
    }
  });
  root.append(nav);
}
function heading(root,title,detail) {
  const h = el('header', 'rw-heading');
  h.append(el('h1', '', title));
  if (detail) h.append(el('p','rw-lede',detail));
  root.append(h);
}
function empty(root, symbol, title, detail, action, run) {
  const wrap = el('div', 'rw-empty');
  wrap.append(icon(symbol,26), el('h2','',title), el('p','',detail));
  if (action) wrap.append(button(action,'rw-action',run));
  root.append(wrap);
}
function kindName(note) {
  return String(note.kind || 'Revision note').replace(/[-_]+/g,' ').replace(/^./, c => c.toUpperCase());
}
function saveButton(ctx,note,full=false,onChange) {
  const b = button('', full ? 'rw-save rw-save-full' : 'rw-save', async () => {
    const before = ctx.state.saved || [];
    const wasSaved = before.includes(note.id);
    ctx.state.saved = wasSaved ? before.filter(id => id !== note.id) : [...before, note.id];
    b.disabled = true;
    paint();
    try {
      await ctx.save();
      onChange?.();
    } catch {
      ctx.state.saved = before;
      paint();
      const problem = el('span','rw-save-problem','Couldn’t save the change. Try again.');
      problem.setAttribute('role','alert');
      b.after(problem);
    } finally { b.disabled = false; }
  });
  function paint() {
    const active = (ctx.state.saved || []).includes(note.id);
    b.setAttribute('aria-pressed', String(active));
    b.setAttribute('aria-label', (active ? 'Remove bookmark for ' : 'Bookmark ') + note.title);
    b.title = active ? 'Remove bookmark' : 'Bookmark this note';
    b.replaceChildren(icon('bookmark',16));
    if (full) b.append(el('span','',active ? 'Bookmarked' : 'Bookmark'));
  }
  paint(); return b;
}
function noteRow(ctx,note,{showCourse=false,onChange,snippet}={}) {
  const row = el('li','rw-row');
  const info = button('','rw-row-link',() => ctx.navigate('reader',note.id));
  const course = courseFor(ctx.state,note);
  const meta = el('span','rw-meta');
  if (showCourse && course) meta.append(el('span','rw-code',course.code),el('span','rw-mid','·'));
  meta.append(el('span','',kindName(note)));
  info.append(meta,el('span','rw-row-title',note.title));
  if (snippet || note.summary) info.append(el('span','rw-row-desc',snippet || note.summary));
  row.append(info,saveButton(ctx,note,false,onChange));
  return row;
}
function noteList(ctx,root,notes,opts={}) {
  const list = el('ul','rw-list');
  notes.forEach(note=>list.append(noteRow(ctx,note,opts)));
  root.append(list);
}
function mathify(node) {
  temml.renderMathInElement(node,{
    throwOnError: false, trust: false, maxExpand: 500, maxSize: [30, 30],
    delimiters:[
      {left:'$$',right:'$$',display:true},
      {left:'\\[',right:'\\]',display:true},
      {left:'\\(',right:'\\)',display:false},
      {left:'$',right:'$',display:false},
    ],
  });
}
// Keep math intact while recognising the common inline markup in generated notes.
function writeInline(container, input) {
  const value = String(input ?? '');
  const re = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$|\*\*[^*\n]+?\*\*|__[^_\n]+?__|`[^`\n]+?`|(?<![\w*])\*(?!\s)[^*\n]+?(?<!\s)\*(?!\w))/g;
  let start = 0;
  for (const match of value.matchAll(re)) {
    container.append(value.slice(start,match.index));
    const piece = match[0];
    if (piece[0] === '$' || piece[0] === '\\') container.append(piece);
    else if (piece.startsWith('**') || piece.startsWith('__')) container.append(el('strong','',piece.slice(2,-2)));
    else if (piece.startsWith('`')) container.append(el('code','',piece.slice(1,-1)));
    else container.append(el('em','',piece.slice(1,-1)));
    start = match.index + piece.length;
  }
  container.append(value.slice(start));
}
function prose(input) {
  const root = el('div','rw-prose');
  const lines = (Array.isArray(input) ? input.join('\n\n') : String(input ?? '')).replace(/\r\n?/g,'\n').split('\n');
  const listPattern = /^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/;
  const boundary = line => !line.trim() || listPattern.test(line) || /^\s*(?:```|#{1,6}\s|>\s?|\$\$|\\\[)/.test(line);
  for (let i=0; i<lines.length;) {
    const line = lines[i++].trim();
    if (!line) continue;
    if (line.startsWith('```')) {
      const block=[];
      while(i<lines.length && !lines[i].trim().startsWith('```')) block.push(lines[i++]);
      if (i<lines.length) i++;
      const pre=el('pre'); pre.append(el('code','',block.join('\n'))); root.append(pre);
      continue;
    }
    if (line.startsWith('$$') || line.startsWith('\\[')) {
      const end = line.startsWith('$$') ? '$$' : '\\]';
      const parts=[line];
      if (!line.slice(2).includes(end)) {
        while(i<lines.length) { const next=lines[i++]; parts.push(next); if(next.includes(end)) break; }
      }
      root.append(el('div','rw-equation',parts.join('\n'))); continue;
    }
    const h=line.match(/^#{1,6}\s+(.+)$/);
    if (h) { const sub=el('h3'); writeInline(sub,h[1]); root.append(sub); continue; }
    const li=line.match(listPattern);
    if (li) {
      const type=li[2] ? 'ol':'ul';
      const list=el(type);
      if (li[2]) list.start=Number(li[2]);
      let match=li;
      for (;;) {
        const item=el('li'); writeInline(item,match[3]); list.append(item);
        const next=lines[i]?.trim().match(listPattern);
        if (!next || Boolean(next[2]) !== Boolean(li[2])) break;
        match=next; i++;
      }
      root.append(list); continue;
    }
    if (line.startsWith('>')) {
      const parts=[line.replace(/^>\s?/,'')];
      while(i<lines.length && lines[i].trim().startsWith('>')) parts.push(lines[i++].trim().replace(/^>\s?/,''));
      const block=el('blockquote'); writeInline(block,parts.join(' ')); root.append(block); continue;
    }
    const parts=[line];
    while(i<lines.length && !boundary(lines[i])) parts.push(lines[i++].trim());
    const p=el('p'); writeInline(p,parts.join(' ')); root.append(p);
  }
  return root;
}
function dateText(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
export function renderReader(ctx) {
  const root=surface(ctx,'reader'), {state}=ctx;
  const note=state.notes.find(n=>n.id===ctx.route.id);
  if (!note) { empty(root,'file','Note unavailable','This note could not be found in your collection.','View courses',()=>ctx.navigate('course')); return; }
  const course=courseFor(state,note);
  crumb(ctx,root,[{label:'Workspace',page:'home'},...(course?[{label:course.code,page:'course',id:course.id}]:[]),{label:kindName(note)}]);
  const top=el('header','rw-readhead');
  const line=el('div','rw-readmeta');
  const courseLink=course && button(course.code+' · '+course.name,'rw-course-link',()=>ctx.navigate('course',course.id));
  if(courseLink) line.append(courseLink);
  line.append(saveButton(ctx,note,true));
  const title=el('h1'); writeInline(title,note.title);
  top.append(line,title);
  if(note.summary){const summary=el('div','rw-lede'); writeInline(summary,note.summary);top.append(summary);}
  const details=el('div','rw-meta');
  details.append(el('span','',kindName(note)));
  const updated=dateText(note.updatedAt);
  if(!note.sources?.length && note.updatedAt===null) details.append(el('span','rw-mid','·'),el('span','','Starter note'));
  if(updated) details.append(el('span','rw-mid','·'),el('span','','Updated '+updated));
  top.append(details); root.append(top);
  const layout=el('div','rw-reading-layout'),body=el('article','rw-article'),side=el('nav','rw-contents');
  side.setAttribute('aria-label','On this page'); side.append(el('h2','rw-smalltitle','On this page'));
  let count=0;
  const section = (title, symbol) => {
    const s=el('section','rw-section');
    const id='rw-section-'+(++count);
    s.id=id; s.tabIndex=-1;
    const h=el('h2');
    if(symbol) h.append(icon(symbol,21));
    writeInline(h,title);
    s.append(h);
    const link=button(title,'rw-contents-link',()=>{s.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});s.focus({preventScroll:true});});
    side.append(link); body.append(s); return s;
  };
  for(const part of note.sections||[]) section(part.heading||'Notes').append(prose(part.body));
  if(note.corrections?.length) {
    const s=section('Corrections','correction');
    for(const correction of note.corrections){
      const block=el('div','rw-correction');
      for(const [label,field] of [['Original','original'],['Corrected','revised'],['Reason','reason']]) {
        if(correction[field]){const row=el('div'); row.append(el('strong','rw-smalltitle',label),prose(correction[field]));block.append(row);}
      }
      s.append(block);
    }
  }
  if(note.extensions?.length) {
    const s=section('Further connections','branch');
    for(const extra of note.extensions) s.append(prose(extra));
  }
  if(note.questions?.length) {
    const s=section('Test your recall','recall');
    for(const qa of note.questions) {
      const d=el('details','rw-question'), q=el('summary');
      const label=el('span');writeInline(label,qa.question);
      q.append(label,icon('down',16));d.append(q,prose(qa.answer));s.append(d);
    }
  }
  if(note.sources?.length) {
    const s=section('Sources','file');
    for(const ref of note.sources) {
      const id=typeof ref==='string' ? ref : ref.sourceId;
      const source=(state.sources||[]).find(src=>src.id===id);
      const label=source?.name || source?.filename || source?.title || 'Source document';
      const info=el('span','rw-source-title',label);
      const page=ref.page;
      if(page!==undefined && page!==null && page!=='') info.append(el('span','rw-source-page',' · p. '+page));
      const link=el(source?'a':'div','rw-source');
      if(source){
        link.href='/api/sources/'+encodeURIComponent(id)+(Number.isInteger(page)&&page>0?'#page='+page:'');
        link.target='_blank';link.rel='noopener';
      }
      link.append(icon('file',18),info);if(source) link.append(icon('chevron',14));s.append(link);
    }
  }
  layout.append(body);
  if(count>1)layout.append(side);
  root.append(layout); mathify(root);
}
function courseCard(ctx,c) {
  const b=button('','rw-course-card',()=>ctx.navigate('course',c.id));
  const items=ctx.state.notes.filter(n=>n.courseId===c.id);
  const cover=el('span','rw-course-art');
  const canvas=el('canvas');canvas.dataset.art=c.theme || c.id;canvas.setAttribute('aria-hidden','true');
  cover.append(canvas);
  b.append(cover,el('span','rw-code',c.code),el('span','rw-card-name',c.name));
  if(c.description) b.append(el('span','rw-card-desc',c.description));
  b.append(el('span','rw-card-count',singular(items.length,'note')));
  return b;
}
export function renderCourse(ctx) {
  const root=surface(ctx,'course'),{state}=ctx;
  if(!ctx.route.id) {
    heading(root,'Course library',singular(state.courses.length,'course')+' in your revision workspace.');
    const grid=el('div','rw-course-grid');
    state.courses.forEach(c=>grid.append(courseCard(ctx,c)));root.append(grid); return;
  }
  const course=state.courses.find(c=>c.id===ctx.route.id);
  if(!course){empty(root,'book','Course unavailable','This course could not be found in your collection.','View courses',()=>ctx.navigate('course'));return;}
  crumb(ctx,root,[{label:'Workspace',page:'home'},{label:'Courses',page:'course'},{label:course.code}]);
  const head=el('header','rw-course-head');
  head.append(el('span','rw-code',course.code),el('h1','',course.name));
  if(course.description) head.append(el('p','rw-lede',course.description));
  root.append(head);
  const notes=state.notes.filter(n=>n.courseId===course.id);
  const bar=el('div','rw-bar');bar.append(el('h2','','Revision notes'),el('span','rw-count',String(notes.length)));root.append(bar);
  if(!notes.length){empty(root,'file','Your course notebook starts here','Add lecture notes or a problem set to build your first revision page.','Add sources',()=>ctx.navigate('sources'));return;}
  const kinds=[...new Set(notes.map(kindName))];
  const results=el('div');root.append(results);
  if(kinds.length>1){
    const wrap=el('label','rw-select-wrap');wrap.append(el('span','rw-sr','Filter notes by type'));
    const select=el('select','rw-select');
    [['','All types'],...kinds.map(k=>[k,k])].forEach(([v,k])=>{const option=el('option','',k);option.value=v;select.append(option);});
    select.addEventListener('change',()=>{results.replaceChildren();noteList(ctx,results,notes.filter(n=>!select.value||kindName(n)===select.value));});
    wrap.append(select,icon('down',14));bar.append(wrap);
  }
  noteList(ctx,results,notes); mathify(root);
}
function normalise(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function noteIndex(state,note) {
  const c=courseFor(state,note);
  const paragraphs=[
    ...(note.sections||[]).flatMap(s=>[s.heading,s.body]),
    ...(note.corrections||[]).flatMap(s=>[s.original,s.revised,s.reason]),
    ...(note.extensions||[]),
    ...(note.questions||[]).flatMap(s=>[s.question,s.answer]),
  ].filter(Boolean).map(String);
  const fields=[note.title,(c?.code||'')+' '+(c?.name||'')+' '+kindName(note),note.summary,paragraphs.join(' ')].map(normalise);
  return {note,fields,paragraphs};
}
export function renderSearch(ctx) {
  const root=surface(ctx,'search');
  heading(root,'Search your archive');
  const form=el('form','rw-search-form');form.setAttribute('role','search');
  const field=el('input');field.type='search';field.placeholder='Search topics, theorems, course numbers…';field.value=ctx.route.q || '';field.setAttribute('aria-label','Search your archive');
  form.append(icon('search',21),field);root.append(form);
  const counter=el('p','rw-result-count'),results=el('div');counter.setAttribute('aria-live','polite');root.append(counter,results);
  const index=ctx.state.notes.map(n=>noteIndex(ctx.state,n));
  function show(){
    const tokens=normalise(field.value).trim().split(/\s+/).filter(Boolean);
    results.replaceChildren();
    if(!tokens.length) {
      counter.textContent=singular(index.length,'revision page');
      noteList(ctx,results,ctx.state.notes,{showCourse:true});mathify(results);return;
    }
    const found=index.map(entry=>{
      let score=0;
      for(const token of tokens){
        const loc=entry.fields.findIndex(f=>f.includes(token));
        if(loc<0) return null;
        score += [8,4,2,1][loc];
      }
      return {entry,score};
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    counter.textContent=singular(found.length,'matching note');
    if(!found.length){empty(results,'search','No matching notes','Try a broader topic, a course number, or a term from your notes.');return;}
    const list=el('ul','rw-list');
    found.forEach(({entry}) => {
      let snippet;
      if(!entry.fields.slice(0,3).some(f=>tokens.some(t=>f.includes(t)))){
        const text=entry.paragraphs.find(p=>tokens.some(t=>normalise(p).includes(t)));
        if(text){const i=normalise(text).indexOf(tokens.find(t=>normalise(text).includes(t)));const a=Math.max(0,i-45),b=Math.min(text.length,i+130);snippet=(a?'…':'')+text.slice(a,b)+(b<text.length?'…':'');}
      }
      list.append(noteRow(ctx,entry.note,{showCourse:true,snippet}));
    });
    results.append(list);mathify(results);
  }
  form.addEventListener('submit',e=>{e.preventDefault();show();});field.addEventListener('input',show);
  show();
}
export function renderSaved(ctx) {
  const root=surface(ctx,'saved');
  heading(root,'Saved pages');
  const notes=(ctx.state.saved||[]).map(id=>ctx.state.notes.find(n=>n.id===id)).filter(Boolean);
  if(!notes.length){empty(root,'bookmark','No bookmarks yet','Bookmark a revision page to keep it here for your next study session.','Browse courses',()=>ctx.navigate('course'));return;}
  root.append(el('p','rw-result-count',singular(notes.length,'saved note')));
  noteList(ctx,root,notes,{showCourse:true,onChange:()=>renderSaved(ctx)});mathify(root);
}
