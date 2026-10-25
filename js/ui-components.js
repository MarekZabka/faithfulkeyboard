// Small shared configuration primitives used by Keyboard and Transformer.
const ConfigUI = (() => {
  const disclosures=new Map();
  const chevron='<svg class="section-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';
  function section(title,{open=true,className='',key}={}) {
    const el=document.createElement('details');el.className=`independent-section ${className}`;
    el.open=key&&disclosures.has(key)?disclosures.get(key):open;
    if(key)el.addEventListener('toggle',()=>disclosures.set(key,el.open));
    const summary=document.createElement('summary');summary.className='editor-section-header';
    const name=document.createElement('span');name.className='section-title';name.textContent=title;
    summary.appendChild(name);summary.insertAdjacentHTML('beforeend',chevron);
    const body=document.createElement('div');body.className='independent-section-body';
    el.append(summary,body);return {el,summary,body};
  }
  function adoptSection(header,body,{open=true,key}={}) {
    if(!header || !body || header.parentElement?.tagName==='SUMMARY') return;
    const component=section('',{open,key});
    const label=header.querySelector('label');
    if(label) {
      const title=document.createElement('span');title.className='section-title';title.textContent=label.textContent;
      header.querySelector('input')?.setAttribute('aria-label',label.textContent);label.replaceWith(title);
    }
    header.parentElement.insertBefore(component.el,header);
    component.summary.replaceChildren(...header.childNodes);
    component.summary.insertAdjacentHTML('beforeend',chevron);
    body.classList.add('independent-section-body');component.body.replaceWith(body);header.remove();
    component.summary.querySelectorAll('input').forEach(input=>input.addEventListener('click',e=>e.stopPropagation()));
    return component.el;
  }
  function tab(button,label) {
    let name=button.querySelector('.tab-label');
    if(!name) {name=document.createElement('span');name.className='tab-label';button.appendChild(name);}
    name.textContent=label;button.title=label;button.setAttribute('aria-label',label);return button;
  }
  function titleBar(bar) {
    bar.classList.add('config-selection-bar');
    bar.style.cssText='display:flex;padding:0.6rem 1rem;align-items:center;gap:0.4rem;position:relative;';
    return bar;
  }
  function picker(name,{id='',icon=''}={}) {
    const button=document.createElement('button');button.type='button';button.className='harmony-title-picker';
    if(id)button.id=id;
    if(icon) {const mini=document.createElement('span');mini.className='config-selection-mini';mini.innerHTML=icon;button.appendChild(mini);}
    const title=document.createElement('span');title.className='harmony-title-name';title.textContent=name;button.appendChild(title);
    button.insertAdjacentHTML('beforeend','<svg class="harmony-title-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>');
    return button;
  }
  function listRow(selected=false) {
    const row=document.createElement('div');row.className='harmony-item'+(selected?' selected':'');return row;
  }
  function autoEnable(body,checkbox,isAdjusted,onEnable) {
    const changed=()=>{if(isAdjusted()){checkbox.checked=true;onEnable();}};
    body.addEventListener('input',changed);body.addEventListener('change',changed);
  }
  function choices(items,onSelect) {
    const list=document.createElement('div');list.className='harmony-title-dropdown';
    for(const item of items) {
      const button=document.createElement('button');button.type='button';
      button.className='harmony-title-dropdown-item'+(item.selected?' active':'');
      if(item.icon){const icon=document.createElement('span');icon.innerHTML=item.icon;button.appendChild(icon);}
      const label=document.createElement('span');label.textContent=item.name;button.appendChild(label);
      button.addEventListener('click',e=>{e.stopPropagation();onSelect(item);});list.appendChild(button);
    }
    return list;
  }
  return {section,adoptSection,tab,titleBar,picker,listRow,autoEnable,choices};
})();
