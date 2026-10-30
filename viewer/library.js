'use strict';
const CONSTELLATION_COLORS = [
 {name:'Sand',value:'#E3B478'}, {name:'Periwinkle',value:'#9AAEFF'},
 {name:'Mint',value:'#5ED5AF'}, {name:'Sky',value:'#62C5E5'},
 {name:'Orchid',value:'#C889D6'}, {name:'Coral',value:'#EE8C79'}
];
const expandedConstellations = new Set();
let libraryConnected=false, libraryWriting=false, dialogTrigger=null, chosenColor=CONSTELLATION_COLORS[0].value;
let glimmerIds=new Set(), glimmerTimer=null;
const actionIcons={folder:'<path d="M20 10V7a2 2 0 0 0-2-2h-7L9 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8M18 13v8m-4-4h8"/>',star:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2L2 9.6l6.2-.9Z"/>',chevron:'<path d="m9 5 7 7-7 7"/>'};
function actionIcon(kind){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML=actionIcons[kind];return svg}
function starColor(node){return colors.get(node.constellationId) || '#FFFFFF'}
function findStar(id){return data.nodes.find(node=>node.id===id)}
function inConstellation(node,id){return id===null||node.constellationId===id||(id!=='.'&&node.constellationId.startsWith(id+'/'))}
function libraryMessage(message,error=false){$('library-status').textContent=message;$('library-status').classList.toggle('error',error)}
function drawLibrary(){
 const nav=$('groups');nav.replaceChildren();
 const all=button('',()=>{activeGroup=null;drawLibrary();refreshGraph()});all.className='group'+(activeGroup===null?' active':'');all.setAttribute('aria-pressed',String(activeGroup===null));
 const count=document.createElement('span');count.className='count';count.textContent=data.nodes.length;
 all.append(dot('#c6d4e1'),document.createTextNode('All constellations'),count);nav.append(all);
 function rows(parent,container){
  for(const constellation of constellations.filter(c=>c.parentId===parent)){
   const item=document.createElement('div');item.className='constellation-item';
   const row=document.createElement('div');row.className='constellation-row'+(activeGroup===constellation.id?' active':'');row.dataset.constellationId=constellation.id;
   const expanded=expandedConstellations.has(constellation.id), childrenId='constellation-'+encodeURIComponent(constellation.id);
   const toggle=button('',()=>{expanded?expandedConstellations.delete(constellation.id):expandedConstellations.add(constellation.id);drawLibrary();document.getElementById(childrenId+'-toggle')?.focus({preventScroll:true})});
   toggle.id=childrenId+'-toggle';toggle.className='constellation-toggle';toggle.setAttribute('aria-label',`${expanded?'Collapse':'Expand'} ${constellation.name}`);toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-controls',childrenId);toggle.append(actionIcon('chevron'));
   const select=button('',()=>{activeGroup=constellation.id;drawLibrary();refreshGraph();document.getElementById(childrenId+'-select')?.focus({preventScroll:true})});select.className='constellation-select';select.id=childrenId+'-select';select.setAttribute('aria-pressed',String(activeGroup===constellation.id));
   const name=document.createElement('span');name.textContent=constellation.name;select.append(dot(constellation.color),name);
   const total=document.createElement('span');total.className='count';total.textContent=data.nodes.filter(n=>inConstellation(n,constellation.id)).length;total.setAttribute('aria-label',`${total.textContent} stars including subfolders`);
   const actions=document.createElement('div');actions.className='constellation-actions';
   for(const [kind,label,action] of [['folder',`Add constellation inside ${constellation.name}`,()=>openLibraryDialog('constellation',constellation.id)],['star',`Add star to ${constellation.name}`,()=>openLibraryDialog('star',constellation.id)]]){
    const wrap=document.createElement('span');wrap.className='library-action';const control=button('',action);control.className='mini-action';control.disabled=!libraryConnected;control.setAttribute('aria-label',label);control.append(actionIcon(kind));
    const tooltip=document.createElement('span');tooltip.className='library-tooltip';tooltip.role='tooltip';tooltip.id=childrenId+'-'+kind+'-tip';tooltip.textContent=label;control.setAttribute('aria-describedby',tooltip.id);wrap.append(control,tooltip);actions.append(wrap);
   }
   row.append(toggle,select,total,actions);item.append(row);
   const children=document.createElement('div');children.id=childrenId;children.className='constellation-children';children.hidden=!expanded;
   if(expanded)rows(constellation.id,children);item.append(children);container.append(item);
  }
 }
 rows(null,nav);
 const query=$('search').value.toLocaleLowerCase();
 const visible=data.nodes.filter(n=>inConstellation(n,activeGroup)&&(n.label+' '+n.name+' '+n.excerpt).toLocaleLowerCase().includes(query));
 $('list-title').textContent=activeGroup===null?'All stars':constellations.find(c=>c.id===activeGroup)?.name||'All stars';$('list-count').textContent=visible.length;$('notes').replaceChildren();
 visible.forEach(n=>{const el=button('',()=>openNote(n));el.className='note-row'+(selected===n.id?' selected':'')+(glimmerIds.has(n.id)?' star-glimmer':'');el.dataset.starId=n.id;el.append(dot(starColor(n)),document.createTextNode(n.label));$('notes').append(el)});
 if(!visible.length){const el=document.createElement('p');el.className='empty';el.textContent=data.nodes.length?'No stars match. Try another search.':'Add a constellation, then bring your files into your universe.';$('notes').append(el)}
 $('note-count').textContent=`${data.nodes.length} stars`;$('graph-meta').textContent=`${data.nodes.length} stars / ${data.links.length} connections`;
}
function setEclipse(open,focus=false){
 $('eclipse').dataset.open=String(open);$('eclipse-core').setAttribute('aria-expanded',String(open));$('eclipse-hint').hidden=open;
 for(const id of ['eclipse-folder','eclipse-star'])$(id).disabled=!open||!libraryConnected;
 if(focus)$('eclipse-core').focus();
}
function expandParents(id){while(id){expandedConstellations.add(id);id=constellations.find(c=>c.id===id)?.parentId}}
function applyLibrary(next){
 const existing=new Map(data.nodes.map(n=>[n.id,n]));
 const nodesChanged=JSON.stringify(data.nodes.map(n=>[n.id,n.excerpt]))!==JSON.stringify(next.nodes.map(n=>[n.id,n.excerpt]));
 data.nodes=next.nodes.map(n=>{const previous=existing.get(n.id);if(previous){Object.assign(previous,n);return previous}return n});
 data.constellations=constellations=next.constellations;data.libraryPath=next.libraryPath;
 colors.clear();constellations.forEach(c=>colors.set(c.id,c.color));
 adjacent.clear();data.nodes.forEach(n=>adjacent.set(n.id,new Set()));
 next.links.forEach(l=>{adjacent.get(l.source)?.add(l.target);adjacent.get(l.target)?.add(l.source)});
 if(nodesChanged){
  // Retain current positions and camera while additions settle into the existing graph.
  for(const node of data.nodes)if(existing.has(node.id)&&Number.isFinite(node.x)){node.fx=node.x;node.fy=node.y;node.fz=node.z}
  data.links=next.links;graph?.graphData(data);
 }
 if(selected!==null&&!findStar(selected)){selected=null;highlighted.clear();$('detail').hidden=true}
 if(activeGroup!==null&&!constellations.some(c=>c.id===activeGroup))activeGroup=null;
 drawLibrary();refreshGraph();
}
async function birthStar(result){
 const parent=findStar(result.relatedId),node=result.graph.nodes.find(n=>n.id===result.nodeId);
 if(!node)throw Error('The saved star was missing from the graph response.');
 const origin={x:parent?.x||0,y:parent?.y||0,z:parent?.z||0};
 for(const axis of ['x','y','z'])node[axis]=node['f'+axis]=origin[axis];
 applyLibrary(result.graph);activeGroup=null;sources.clear();selected=null;highlighted=new Set([node.id]);
 $('search').value='';expandParents(node.constellationId);glimmerIds.add(node.id);drawLibrary();refreshGraph();holdCamera();
 if(!graph)throw Error('The galaxy renderer is unavailable.');
 await new Promise(resolve=>{
  const started=performance.now();
  function frame(now){
   const progress=reducedMotion.matches?1:Math.min(1,(now-started)/800),ease=progress*progress*(3-2*progress);
   for(const [axis,offset] of [['x',38],['y',24],['z',18]])node[axis]=node['f'+axis]=origin[axis]+offset*ease;
   const glow=objects.get(node.id)?.children[1];
   if(glow){glow.scale.set(25*(1+3*Math.sin(Math.PI*progress)),25*(1+3*Math.sin(Math.PI*progress)),1);glow.material.opacity=.42+.58*Math.sin(Math.PI*progress)}
   if(progress<1)requestAnimationFrame(frame);
   else{glimmerIds.delete(node.id);openNote(node);resolve()}
  }
  requestAnimationFrame(frame);
 });
}
function setColor(value){chosenColor=value;$('custom-color').value=value;$('color-value').textContent=value.toUpperCase();for(const button of $('color-presets').children)button.setAttribute('aria-pressed',String(button.dataset.color.toLowerCase()===value.toLowerCase()))}
function fillTargets(select,root){
 select.replaceChildren();const option=document.createElement('option');option.value='';option.textContent=root?'Your library':'Choose a constellation';option.disabled=!root;select.append(option);
 for(const c of constellations){const option=document.createElement('option');option.value=c.id;option.textContent=c.id==='.'?'Your library':c.id.split('/').join(' / ');select.append(option)}
}
function openLibraryDialog(kind,parent=activeGroup){
 dialogTrigger=document.activeElement;setEclipse(false);
 if(!libraryConnected){libraryMessage('Connect your library by starting Cosmos with start.ps1 -Notes followed by your folder path, then reload this page.',true);return}
 const isFolder=kind==='constellation';$('library-form').reset();$('library-dialog').dataset.kind=kind;
 $('library-dialog-title').textContent=isFolder?'Add constellation':'Add star';$('library-dialog-description').textContent=isFolder?'Create a folder in your connected library.':'Copy files into a constellation. Original files stay where they are.';
 $('folder-fields').hidden=!isFolder;$('star-fields').hidden=isFolder;$('folder-name').required=isFolder;$('star-files').required=!isFolder;$('star-target').required=!isFolder;
 $('library-submit').textContent=isFolder?'Create':'Add';$('library-form-error').textContent='';$('selected-files').replaceChildren();
 fillTargets($('folder-parent'),true);fillTargets($('star-target'),false);$('folder-parent').value=parent??'';$('star-target').value=parent??'';
 setColor(constellations.find(c=>c.id===parent)?.color||CONSTELLATION_COLORS[0].value);
 $('library-dialog').showModal();$(isFolder?'folder-name':'star-target').focus();
}
function closeLibraryDialog(){if(libraryWriting)return;$('library-dialog').close();(dialogTrigger?.isConnected&&!dialogTrigger.disabled?dialogTrigger:$('eclipse-core')).focus()}
async function initializeLibrary(){
 for(const preset of CONSTELLATION_COLORS){const control=button('',()=>setColor(preset.value));control.className='color-preset';control.dataset.color=preset.value;control.setAttribute('aria-label',preset.name);control.append(dot(preset.value));$('color-presets').append(control)}
 $('custom-color').addEventListener('input',e=>setColor(e.target.value));
 $('folder-parent').addEventListener('change',()=>setColor(constellations.find(c=>c.id===$('folder-parent').value)?.color||CONSTELLATION_COLORS[0].value));
 $('eclipse-folder').append(actionIcon('folder'));$('eclipse-star').append(actionIcon('star'));
 $('eclipse-core').onclick=()=>setEclipse($('eclipse').dataset.open!=='true');
 $('eclipse-folder').onclick=()=>openLibraryDialog('constellation');$('eclipse-star').onclick=()=>openLibraryDialog('star');
 $('eclipse').addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();setEclipse(false,true)}});
 $('eclipse').addEventListener('focusout',event=>{if(!event.currentTarget.contains(event.relatedTarget))setEclipse(false)});
 document.addEventListener('pointerdown',event=>{if(!$('eclipse').contains(event.target))setEclipse(false)});
 $('library-cancel').onclick=closeLibraryDialog;
 $('library-dialog').addEventListener('cancel',event=>{event.preventDefault();closeLibraryDialog()});
 $('library-dialog').addEventListener('keydown',event=>{
  if(event.key==='Escape')event.stopPropagation();
  if(event.key==='Tab'){
   const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(el=>el.getClientRects().length);
   const first=controls[0],last=controls.at(-1);
   if(!first){event.preventDefault();return}
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
 });
 $('star-files').onchange=()=>{const list=$('selected-files');list.replaceChildren();for(const file of $('star-files').files){const item=document.createElement('li');item.textContent=file.name;list.append(item)}};
 $('library-form').onsubmit=async event=>{
  event.preventDefault();if(libraryWriting)return;
  const folder=$('library-dialog').dataset.kind==='constellation';
  const parent=folder?$('folder-parent').value||null:$('star-target').value;
  const body=folder?{parentId:parent,name:$('folder-name').value,color:chosenColor}:new FormData();
  if(!folder){body.append('constellationId',parent);for(const file of $('star-files').files)body.append('files',file)}
  libraryWriting=true;$('library-form-error').textContent='';$('library-form').setAttribute('aria-busy','true');
  const controls=[...$('library-form').querySelectorAll('button,input,select')];controls.forEach(control=>control.disabled=true);$('library-submit').textContent=folder?'Creating…':'Adding…';
  try{
   const before=new Set(data.nodes.map(n=>n.id));let result;
   if(folder)result=await api('/library/constellations',body);
   else{const response=await fetch('/library/stars',{method:'POST',body});result=await response.json();if(!response.ok)throw Error(result.error||'Could not import your files.')}
   applyLibrary(result);expandParents(parent);
   if(folder){const created=(parent&&parent!=='.'?parent+'/':'')+body.name;activeGroup=created;expandParents(created)}else activeGroup=parent;
   glimmerIds=new Set(data.nodes.filter(n=>!before.has(n.id)).map(n=>n.id));drawLibrary();refreshGraph();
   clearTimeout(glimmerTimer);glimmerTimer=setTimeout(()=>{glimmerIds.clear();$('eclipse-core').classList.remove('star-glimmer');drawLibrary()},900);$('eclipse-core').classList.add('star-glimmer');
   libraryMessage(folder?'Constellation created.':`${glimmerIds.size} ${glimmerIds.size===1?'star':'stars'} added.`);
   libraryWriting=false;closeLibraryDialog();
  }catch(error){$('library-form-error').textContent=error.message||'Could not save. Your input is kept.'}
  finally{libraryWriting=false;controls.forEach(control=>control.disabled=false);$('library-submit').textContent=folder?'Create':'Add';$('library-form').setAttribute('aria-busy','false')}
 };
 try{const next=await api('/library');libraryConnected=true;applyLibrary(next);$('library-location').textContent='Connected library';$('library-location').title=next.libraryPath;libraryMessage('')}
 catch(error){$('library-location').textContent='Library connection needed';libraryMessage('Start Cosmos with start.ps1 -Notes and your folder path, then reload to add folders or files.',true);drawLibrary()}
 setEclipse(false);controls();
}
