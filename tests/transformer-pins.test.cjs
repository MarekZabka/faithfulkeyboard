const assert=require('node:assert/strict');
async function run(page,url='http://127.0.0.1:8766') {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.svg-key').first().waitFor();
  await page.locator('[data-tab="harmony"]').click();await page.locator('#btn-edit-harmony-toggle').click();
  const section=id=>page.locator(`#${id}`).locator('xpath=ancestor::details[1]');
  const shape=page.locator('#he-shape').locator('xpath=ancestor::details[1]');
  assert.equal(await shape.locator('#he-opacity').count(),1);
  assert.equal(await shape.locator('#he-key-style').count(),0);
  for(const element of [shape,section('he-connect-tones')])
    assert.notEqual(await element.evaluate(e=>e.previousElementSibling?.tagName),'HR');
  await shape.locator('> summary').click();
  assert.equal(await page.locator('#he-key-style').isVisible(),true);
  await shape.locator('> summary').click();
  for(const id of ['he-key-style','he-key-rotation-check','he-key-stretch','he-connect-tones','he-labels2'])
    assert.equal(await section(id).getAttribute('open'),null,`${id} should start collapsed`);
  for(const [check,field,value] of [['he-key-style','he-rounding','0.3'],['he-key-rotation-check','he-rot','30'],
    ['he-key-stretch','he-sx','1.5'],['he-connect-tones','he-connect-width','3'],
    ['he-labels2','he-font2','14']]) {
    await section(check).locator('> summary .section-title').click();
    await page.locator(`#${field}`).focus();await page.locator(`#${field}`).press('ArrowRight');
    assert.equal(await page.locator(`#${check}`).isChecked(),true);
  }
  await page.locator('[data-tab="layout"]').click();
  const hide=page.locator('#hide-labels').locator('xpath=ancestor::details[1]');
  assert.equal(await hide.locator('> summary .section-title').textContent(),'Hide');
  assert.equal(await hide.locator('#hide-labels2, #hide-connections').count(),2);
  await page.locator('[data-tab="harmony"]').click();
  // Use ordinary round markers in the geometry regression.
  await page.locator('#he-rot').focus();await page.locator('#he-rot').press('ArrowLeft');
  await page.locator('#he-sx').focus();await page.locator('#he-sx').press('ArrowLeft');
  await page.locator('[title="Transform"]').first().click();
  await page.locator('#tf-tones').fill('1, 5/4, 3/2');
  await page.locator('[data-tf-tab="layout"]').click();
  assert.equal(await page.locator('[data-tf-tab="layout"] .tab-label').isVisible(),true);
  assert.equal(await page.locator('[data-tf-tab="harmony"] .tab-label').isVisible(),false);
  for(const path of ['showSchritts','showCollapses','toneLabels.show'])
    assert.equal(await page.locator(`[data-setting="${path}"]`).evaluate(e=>e.parentElement.firstElementChild===e),true);
  await page.locator('[data-tf-tab="harmony"]').click();
  await page.locator('.tf-point[data-monomial="bc"]').click();
  const menu=page.locator('#tf-point-menu');
  assert.deepEqual(await menu.locator('.tf-menu-action').evaluateAll(es=>es.map(e=>e.dataset.action)),['pin','transport']);
  assert.equal(await menu.locator('.tf-menu-action').first().evaluate(e=>e.firstElementChild.tagName.toLowerCase()),'svg');
  await menu.getByRole('button',{name:'Pin neighborhood',exact:true}).click();
  await menu.getByRole('button',{name:'Close actions',exact:true}).click();
  await page.locator('#tf-fit').click();
  await page.locator('.tf-point[data-monomial="b^2c/a"]').click();
  await menu.getByRole('button',{name:'Pin neighborhood',exact:true}).click();
  await menu.getByRole('button',{name:'Close actions',exact:true}).click();
  const child=page.locator('.tf-point[data-monomial="b^2c/a"]').first();
  const center=await child.locator('circle,ellipse').evaluate(e=>[e.getAttribute('cx'),e.getAttribute('cy')]);
  const camera=await page.locator('#tf-diagram').getAttribute('viewBox');
  await page.locator('[data-tf-tab="pinned"]').click();
  const pins=page.locator('#tf-pane-pinned > .tf-collection > .tf-list-item');
  assert.equal(await pins.count(),2);
  assert.equal(await pins.first().locator('.tf-neighborhood-mini > svg').count(),2);
  await pins.filter({has:page.locator('.harmony-name', {hasText:/^bc of/})}).locator('[title="Unpin neighborhood"]').click();
  assert.equal(await pins.count(),1);
  assert.ok((await pins.first().textContent()).includes('b^2c/a'));
  assert.deepEqual(await child.locator('circle,ellipse').evaluate(e=>[e.getAttribute('cx'),e.getAttribute('cy')]),center);
  assert.equal(await page.locator('#tf-diagram').getAttribute('viewBox'),camera);
  assert.equal(await page.locator('#tf-pane-pinned .tf-pinned-transformations').count(),0);
  await page.locator('[data-tf-tab="transformations"]').click();
  const primary=page.locator('#tf-pane-transformations > .tf-collection .tf-list-item');
  assert.equal(await primary.count(),13);
  assert.equal(await primary.filter({has:page.locator('.harmony-name',{hasText:'b^2c/a'})}).count(),0);
  const row=primary.filter({has:page.locator('.harmony-name',{hasText:/^Schritt a\/b$/})});
  assert.deepEqual(await row.locator('.tf-list-action').evaluateAll(es=>es.map(e=>e.dataset.action)),['pin','transport']);
  const pinIcon=await row.locator('[data-action="pin"] svg').innerHTML();
  await row.locator('[data-action="pin"]').click();
  assert.equal(await row.locator('[data-action="pin"]').getAttribute('aria-pressed'),'true');
  assert.equal(await row.locator('[data-action="pin"] svg').innerHTML(),pinIcon);
  const transportIcon=await row.locator('[data-action="transport"] svg').innerHTML();
  await row.locator('[data-action="transport"]').click();
  await page.locator('#app-confirm-dialog [data-confirm]').click();
  assert.equal(await row.locator('[data-action="transport"]').getAttribute('aria-pressed'),'true');
  assert.equal(await row.locator('[data-action="transport"] svg').innerHTML(),transportIcon);
  await row.click();
  assert.equal(await page.locator('#tf-collection-title').count(),0);
  assert.equal(await row.locator('..').locator('.tf-selected-tones .tone-table tbody tr').count(),3);
  await row.locator('[data-action="transport"]').click();
  assert.equal(await page.locator('#app-confirm-dialog').count(),0);
  assert.equal(await row.locator('[data-action="transport"]').getAttribute('aria-pressed'),'false');
  await row.locator('[data-action="transport"]').click();
  await page.locator('[data-tf-tab="transported"]').click();
  assert.equal(await page.locator('#tf-pane-transported .tf-selected-tones .tone-table tbody tr').count(),3);
  await page.locator('[data-tf-tab="layout"]').click();
  await page.locator('.tf-tone-label[data-depth="0"]').first().hover();
  assert.notEqual(await page.locator('.tf-hover-visible circle').first().getAttribute('fill'),'none');
  await page.locator('.tf-point[data-monomial="a/b"][data-depth="0"]').click();
  assert.equal(await menu.isVisible(),true);
  await page.locator('[data-tf-tab="harmony"]').click();
  assert.equal(await menu.isVisible(),false);
  await page.locator('#tf-save').click();await page.locator('#tf-close').click();
  const transported=page.locator('#harmony-list .transported-harmony');
  assert.equal(await transported.locator('.transport-badge').count(),0);
  await transported.click();
  assert.equal(await page.locator('#he-name').isDisabled(),true);
  assert.equal(await page.locator('#he-ratios').isDisabled(),true);
  assert.equal(await page.locator('#he-ratios').evaluate(e=>getComputedStyle(e).userSelect),'none');
  await page.locator('#harmony-title-picker').click();
  await page.locator('#harmony-editor-title .harmony-title-dropdown-item').first().click();
  assert.equal(await page.locator('#he-name').isEditable(),true);
  assert.notEqual(await section('he-key-style').getAttribute('open'),null);
  await page.locator('#harmony-title-picker').click();
  await page.locator('#harmony-editor-title .harmony-title-dropdown-item').last().click();
  assert.equal(await page.locator('#he-name').isDisabled(),true);
  const legacy=JSON.parse(await page.evaluate(()=>buildProjectJSON()));
  legacy.harmonies[0].transformer.activeTab='derived';
  await page.locator('#import-file').setInputFiles({name:'legacy-pins.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await page.locator('[data-tab="harmony"]').click();
  await page.locator('#harmony-list .harmony-item:not(.transported-harmony) [title="Transform"]').click();
  assert.equal(await page.locator('[data-tf-tab="pinned"]').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#tf-pane-pinned > .tf-collection > .tf-list-item').count(),2);
  assert.deepEqual(await page.locator('.tf-point[data-monomial="b^2c/a"]').first().locator('circle,ellipse')
    .evaluate(e=>[e.getAttribute('cx'),e.getAttribute('cy')]),center);
  assert.deepEqual(errors,[]);
  console.log('PASS independent pins, shared configuration components, primary lists, sticky details and immediate withdrawal');
}
module.exports=run;
if(require.main===module) {
  (async()=>{const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,channel:'chromium'});
    try{await run(await browser.newPage({viewport:{width:1440,height:960}}),process.argv[2]);}finally{await browser.close();}
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
