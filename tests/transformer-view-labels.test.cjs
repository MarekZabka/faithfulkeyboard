const assert=require('node:assert/strict');
async function run(page,url='http://127.0.0.1:8766') {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="harmony"]').click();
  await page.locator('#btn-edit-harmony-toggle').click();
  await page.locator('[title="Transform"]').first().click();
  const field=p=>page.locator(`[data-setting="${p}"]`);
  const view=()=>page.locator('#tf-diagram').getAttribute('viewBox');
  const camera=()=>page.locator('#tf-diagram').evaluate(svg=>{
    const r=svg.getBoundingClientRect(),m=svg.getScreenCTM(),p=svg.createSVGPoint();p.x=r.left;p.y=r.top;
    const origin=p.matrixTransform(m.inverse());return {x:origin.x,y:origin.y,units:1/m.a};
  });
  const initial=await view();
  assert.equal(await field('collapses.edgeWidth').inputValue(),'4');
  assert.equal(await field('collapses.hideDerived').isChecked(),true);
  assert.equal(await field('toneLabels.hideDerived').isChecked(),false);
  assert.equal(await field('toneLabels.showLetter').isChecked(),true);
  for(const group of ['label','shape','style','geometry']) {
    assert.equal(await page.locator(`[data-sync-toggle="${group}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator(`[data-sync-toggle="${group}"]`).getAttribute('title'),'Keep in sync with Schritt');
    assert.equal(await page.locator(`[data-sync-reset="${group}"]`).getAttribute('title'),'Copy from Schritt');
  }
  for(const p of ['toneLabels.show','showSchritts','showCollapses']) {
    assert.equal(await field(p).locator('..').locator('.section-title').count(),1);
    assert.equal(await field(p).locator('..').locator('.section-title').evaluate(e=>getComputedStyle(e).textTransform),'uppercase');
    assert.equal(await field(p).locator('..').locator('.section-title').evaluate(e=>getComputedStyle(e).fontWeight),'700');
  }
  await page.locator('[data-tf-tab="layout"]').click();
  assert.equal(await field('secondarySize').isVisible(),false);
  await field('flipSchritts').check();
  assert.equal(await field('secondarySize').isVisible(),true);
  await field('flipSchritts').uncheck();
  assert.equal(await field('secondarySize').isVisible(),false);
  await page.locator('[data-tf-tab="harmony"]').click();
  await page.locator('#tf-tones').fill('1, 9/8, 3/2');
  await page.locator('[data-tf-tab="layout"]').click();
  await field('toneLabels.type').selectOption('ratio');
  await field('circle.size').fill('320');
  await page.locator('.tf-point[data-monomial="bc"]').click();
  await page.getByRole('button',{name:'Pin neighborhood',exact:true}).click();
  await page.locator('#tf-point-menu [aria-label="Close actions"]').click();
  assert.equal(await view(),initial);
  await field('toneLabels.hideDerived').check();
  assert.equal(await page.locator('.tf-tone-label').count(),3);
  await field('toneLabels.hideDerived').uncheck();
  assert.equal(await page.locator('.tf-tone-label').count(),6);
  assert.ok((await page.locator('.tf-tone-label').first().textContent()).includes('a = '));
  await field('toneLabels.showLetter').uncheck();
  for(const label of await page.locator('.tf-tone-label').allTextContents()) assert.ok(!label.includes(' = '));
  await page.locator('[data-tf-tab="design"]').click();
  await page.locator('summary').filter({hasText:/^Schritt Label$/}).click();
  await page.locator('summary').filter({hasText:/^Wechsel Label$/}).click();
  await field('schritt.hideDerivedLabels').check();
  assert.equal(await field('wechsel.hideDerivedLabels').isChecked(),true);
  assert.equal(await page.locator('.tf-point[data-depth="1"] > text').count(),0);
  assert.equal(await page.locator('.tf-point[data-depth="0"] > text').count(),13);
  await page.locator('[data-sync-toggle="label"]').click();
  await field('wechsel.hideDerivedLabels').uncheck();
  assert.ok(await page.locator('.tf-point[data-depth="1"][aria-label^="Wechsel"] > text').count()>0);
  assert.equal(await page.locator('.tf-point[data-depth="1"][aria-label^="Schritt"] > text').count(),0);
  await page.locator('[data-tf-tab="layout"]').click();
  await field('showCollapses').check();
  assert.equal(await page.locator('[data-layer="collapses"] line[data-depth="1"]').count(),0);
  for(const [kind,width,dash] of [['ww','4',''],['ss','2',''],['sw','2','8 6']]) {
    const line=page.locator(`[data-layer="collapses"] line[data-kind="${kind}"]`).first();
    assert.ok(await line.count()>0,`Missing ${kind} collapse fixture`);
    assert.equal(await line.getAttribute('stroke-width'),width);
    assert.equal(await line.getAttribute('stroke-dasharray'),dash);
  }
  await field('collapses.hideDerived').uncheck();
  assert.ok(await page.locator('[data-layer="collapses"] line[data-depth="1"]').count()>0);
  await page.locator('#tf-fit').click();
  assert.notEqual(await view(),initial);
  const stage=await page.locator('#tf-diagram').boundingBox();
  const beforeWheel=await view();
  await page.mouse.move(stage.x+stage.width*.6,stage.y+stage.height*.6);
  await page.mouse.wheel(0,-170);
  await page.waitForFunction(before=>document.querySelector('#tf-diagram').getAttribute('viewBox')!==before,beforeWheel);
  const zoomed=await view();
  await page.mouse.move(stage.x+25,stage.y+25);
  await page.mouse.down();
  await page.mouse.move(stage.x+65,stage.y+50,{steps:5});
  await page.mouse.up();
  const panned=await view();
  const pannedCamera=await camera();
  assert.notEqual(panned,zoomed);
  await field('circle.rotation').fill('20');
  for(const [key,value] of Object.entries(await camera()))assert.ok(Math.abs(value-pannedCamera[key])<.01);
  await page.locator('#tf-save').click();
  const json=await page.evaluate(()=>buildProjectJSON());
  assert.deepEqual(JSON.parse(json).harmonies[0].transformer.viewport,panned.split(' ').map(Number));
  await page.locator('#tf-close').click();
  await page.locator('#import-file').setInputFiles({name:'view.json',mimeType:'application/json',buffer:Buffer.from(json)});
  await page.locator('[data-tab="harmony"]').click();
  await page.locator('[title="Transform"]').first().click();
  for(const [key,value] of Object.entries(await camera()))assert.ok(Math.abs(value-pannedCamera[key])<.01);
  await page.locator('#tf-fit').click();
  await page.locator('.tf-tone-label[data-depth="0"][data-tone-index="0"]').hover();
  assert.equal(await page.locator('#tf-diagram > g').first().getAttribute('data-layer'),'hover-highlight');
  assert.equal(await page.locator('.tf-hover-visible').count(),1);
  assert.equal(await page.locator('.tf-hover-visible').evaluate(e=>getComputedStyle(e).transitionDuration),'0.35s');
  await page.locator('#tf-title').hover();
  // Leave is delayed, rather than removing the highlight in the pointerleave handler.
  assert.equal(await page.locator('.tf-hover-visible').count(),1);
  await page.locator('.tf-hover-layer').waitFor({state:'detached'});
  assert.equal(await page.locator('.tf-emphasized').count(),0);
  await page.locator('#tf-reset').click();
  for(const [key,value] of Object.entries(await camera()))assert.ok(Math.abs(value-pannedCamera[key])<.01);
  await page.locator('[data-tf-tab="harmony"]').click();
  await page.locator('#tf-tones').fill('invalid');
  await page.locator('#tf-diagram').click();
  assert.deepEqual(errors,[]);
  console.log('PASS Transformer persistent view, derived labels/collapses, collapse styles and hover transitions');
}
module.exports=run;
if(require.main===module) {
  (async()=>{
    const {chromium}=require('playwright');
    const browser=await chromium.launch({headless:true,channel:'chromium'});
    try {await run(await browser.newPage({viewport:{width:1440,height:960}}),process.argv[2]);}
    finally {await browser.close();}
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
