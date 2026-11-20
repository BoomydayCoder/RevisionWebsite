import { courses, notes as starters } from './content.js'
import { paintArt } from './art.js'
import { renderCourse, renderReader, renderSaved, renderSearch } from './reader.js'
import { renderSources, renderStudio } from './importer.js'

const paths={
 stack:'<path d="m3 7 9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4"/>',
 home:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 course:'<path d="M3 4h4v16H3zM10 4h4v16h-4zM16 5l4-1 3 15-4 1z"/>',
 sources:'<path d="M5 6H3v15h14v-2M7 2h9l5 5v10H7zM16 2v6h5M10 11h7M10 14h5"/>',
 studio:'<path d="m4 20 4-1 12-12-3-3L5 16zM13 8l3 3M3 5h5M5.5 2.5v5M19 14v5M16.5 16.5h5"/>',
 saved:'<path d="M6 3h12v18l-6-4-6 4z"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.7"/><path d="m16 16 5 5"/>',
 upload:'<path d="M12 15V3m-5 5 5-5 5 5M4 14v6h16v-6"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',
 page:'<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 16h6"/>',
 book:'<path d="M3 4c4-1 6 0 9 2 3-2 6-3 9-2v15c-4-1-6 0-9 2-3-2-6-3-9-2zM12 6v15"/>',
 spark:'<path d="m12 2 2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z"/>',
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 close:'<path d="m5 5 14 14M19 5 5 19"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 leaf:'<path d="M3 10h5v10H3zM10 4h5v16h-5zM17 7h4v13h-4z"/>'
}
function icons(name,size=18){return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.page)+'</svg>'}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const art=id=>'<canvas data-art="'+escape(id)+'" aria-hidden="true"></canvas>'
function loadList(key){try{let value=JSON.parse(localStorage.getItem('folio:'+key));return Array.isArray(value)?value.filter(i=>typeof i==='string'):[]}catch{return []}}
const state={courses,notes:[...starters],sources:[],notebookCourses:[],saved:loadList('saved'),aiConfigured:false}
let recent=loadList('recent'), dataError='', mobileOpen=false,route
async function api(path,options){
  let response=await fetch(path, options)
  let body
  try{body=await response.json()}catch{throw new Error('The revision workspace could not reach its storage. Please reopen the workspace and try again.')}
  if(!response.ok)throw new Error(body.error || body.message || 'The request could not be completed.')
  return body
}
async function refresh(){
  const data=await api('/api/state')
  state.notebookCourses=Array.isArray(data.notebookCourses)?data.notebookCourses:[]
  state.sources=data.sources || [];state.notes=[...(data.notes || []),...starters];state.aiConfigured=Boolean(data.aiConfigured);dataError=''
}
function save(){localStorage.setItem('folio:saved',JSON.stringify(state.saved));updateNav()}
function markRead(id){recent=[id,...recent.filter(n=>n!==id)].slice(0,30);try{localStorage.setItem('folio:recent',JSON.stringify(recent))}catch{}}
function href(page,id='',q=''){return '#/'+[page,id].filter(Boolean).map(encodeURIComponent).join('/')+(q?'?q='+encodeURIComponent(q):'')}
function navigate(page,id='',q=''){const target=href(page==='note'?'reader':page,id,q);if(location.hash===target){render();return}location.hash=target}
function readRoute(){
  const parts=location.hash.replace(/^#\/?/,'').split('?'), path=parts[0].split('/');let id=''
  try{id=decodeURIComponent(path[1]||'')}catch{}
  return {page:path[0]||'home',id,q:new URLSearchParams(parts[1]||'').get('q')||''}
}
const names={home:'Overview',course:'Course library',sources:'Source files',studio:'Import studio',saved:'Saved pages',reader:'Revision page',search:'Search'}
function navItem(p,label){return '<a class="nav-item" data-nav="'+p+'" href="'+href(p)+'">'+icons(p)+'<span>'+label+'</span></a>'}
function shell(){
  document.getElementById('app').innerHTML=`<div class="shell"><div class="backdrop" hidden></div><aside class="sidebar" id="sidebar"><a class="brand" href="#/home" aria-label="Folio overview"><span class="brandmark">${icons('stack',25)}</span>Folio<span class="brand-dot">.</span></a><div class="nav-area"><div class="side-label">Workspace</div><nav class="nav-list" aria-label="Workspace">${navItem('home','Overview')}${navItem('course','Course library')}${navItem('studio','Import studio')}${navItem('sources','Source files')}${navItem('saved','Saved pages')}</nav><div class="nav-divider"></div><div class="side-label">My courses</div><nav class="nav-list course-links" aria-label="My courses">${courses.map(c=>`<a data-course="${c.id}" href="${href('course',c.id)}"><i class="course-dot ${c.id}"></i>${escape(c.code)}<span>${escape(({algebra:'Algebra',analysis:'Analysis',cosmology:'Cosmology',linguistics:'Linguistics'})[c.id])}</span></a>`).join('')}</nav></div><div class="side-footer"><div class="school-icon">${icons('leaf',21)}</div><div><strong>MIT workspace</strong><small>Fall 2026</small></div></div></aside><div class="workbench"><header class="topbar"><button type="button" class="menu-toggle" aria-controls="sidebar" aria-label="Open navigation">${icons('menu')}</button><div class="breadcrumbs"><a href="#/home">Workspace</a><span>/</span><span id="current-location">Overview</span></div><button type="button" class="global-search">${icons('search',16)}<span>Search library</span><kbd>⌘ K</kbd></button></header><main id="main" class="main" tabindex="-1"></main></div></div>`
  document.querySelector('.global-search').onclick=()=>navigate('search')
  document.querySelector('.menu-toggle').onclick=()=>toggleMenu(!mobileOpen)
  document.querySelector('.backdrop').onclick=()=>toggleMenu(false)
}
function toggleMenu(open){mobileOpen=open;document.body.classList.toggle('menu-open',open);document.querySelector('.backdrop').hidden=!open;document.querySelector('.menu-toggle').setAttribute('aria-expanded',String(open))}
function updateNav(){
  if(!route)return
  document.querySelectorAll('[data-nav]').forEach(el=>{let active=el.dataset.nav===route.page||(el.dataset.nav==='course'&&route.page==='reader');if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')})
  document.querySelectorAll('.course-links [data-course]').forEach(el=>el.classList.toggle('selected',route.page==='course'&&route.id===el.dataset.course))
}
function courseCard(c){
  const count=state.notes.filter(n=>n.courseId===c.id).length
  return `<a class="desk-card" href="${href('course',c.id)}"><div class="card-art ${c.id}">${art(c.id)}</div><div class="card-info"><span class="course-code">${escape(c.code)}</span><h3>${escape(c.id==='linguistics'?'Intro to Linguistics':c.name)}</h3><span class="page-count">${icons('page',14)} ${count} revision pages</span></div></a>`
}
function home(main){
  const read=recent.map(id=>state.notes.find(n=>n.id===id)).filter(Boolean)
  const available=state.notes.filter(n=>n.id!=='bilinear-forms')
  const suggest=[...new Set([...(read.length?read:available.filter((n,i,a)=>a.findIndex(v=>v.courseId===n.courseId)===i)),...available])].slice(0,4)
  const latest=state.notes.filter(n=>n.updatedAt)
  const rows=read.length?read.slice(0,4):latest.length?latest.slice(0,4):suggest
  main.innerHTML=`<div class="desk"><div class="desk-heading"><div><div class="kicker"><i></i> Fall 2026</div><h1>Revision desk</h1><p>Your notes, problem sets and proofs, organised by course.</p></div><a class="upload-btn" href="#/studio">${icons('upload',17)} Import PDFs</a></div>
  <article class="feature"><div class="featured-art" role="img" aria-label="A ruled hyperboloid, the level surface x squared plus y squared minus z squared equals one">${art('feature')}<span class="surface-caption" aria-hidden="true">x² + y² − z² = 1</span></div><div class="feature-copy"><div class="feature-kicker">${icons('spark',16)} Featured reading</div><h2>Bilinear forms<br><em>and duality</em></h2><p>How a pairing turns every vector into a linear functional.</p><a class="feature-link" href="#/reader/bilinear-forms">${icons('book',16)} Read note</a></div></article>
  <section class="shelf"><div class="section-heading"><h2>Course library</h2><a href="#/course">View all courses</a></div><div class="desk-grid">${courses.map(courseCard).join('')}</div></section>
  <section class="desk-pages"><div class="section-heading"><h2>${read.length?'Recently opened':latest.length?'Recently added':'From the notebooks'}</h2><a href="#/search">Browse pages</a></div><div class="desk-page-list">${rows.map(n=>{const c=courses.find(v=>v.id===n.courseId);return `<a class="desk-row" href="${href('reader',n.id)}"><div class="row-icon ${escape(c?.id)}">${icons('page',19)}</div><div><strong>${escape(n.title)}</strong><span>${escape(c?.code)} · ${escape(c?.name)}</span></div><small>${escape(n.kind)}</small></a>`}).join('')}</div></section></div>`
}
function render(){
  route=readRoute();toggleMenu(false);updateNav()
  const main=document.getElementById('main'), page=route.page
  const ctx={main,state,route,navigate,save,escape,icons,art,refresh,api}
  const views={home:()=>home(main),course:renderCourse,reader:renderReader,saved:renderSaved,search:renderSearch,sources:renderSources,studio:renderStudio}
  if(page==='reader'&&state.notes.some(n=>n.id===route.id))markRead(route.id)
  ;(views[page]||views.home)(ctx)
  const label=names[page]||'Overview'
  document.getElementById('current-location').textContent=label
  document.title=(page==='reader'?state.notes.find(n=>n.id===route.id)?.title:page==='course'&&route.id?courses.find(c=>c.id===route.id)?.name:label)||label
  document.title+=' · Folio'
  if(dataError&&(page==='studio'||page==='sources')){const msg=document.createElement('div');msg.className='connection-error';msg.setAttribute('role','alert');msg.textContent=dataError;main.prepend(msg)}
  paintArt(main);window.scrollTo(0,0)
  if(page==='search')main.querySelector('input[type=search]')?.focus()
}
shell()
document.addEventListener('keydown',event=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();navigate('search')}
  if(event.key==='Escape'&&mobileOpen)toggleMenu(false)
})
let ready=false
function showRoute(){
  if(ready || readRoute().page==='home'){render();return}
  document.getElementById('main').innerHTML='<p role="status">Opening your revision workspace…</p>'
}
window.addEventListener('hashchange',showRoute)
showRoute()
refresh().catch(err=>{dataError=err.message}).finally(()=>{ready=true;render()})
