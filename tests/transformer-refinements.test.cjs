// Interaction regression tests for the draggable/resizable Transformer and synced styles.
const assert=require('node:assert/strict');

async function run(page,url='http://127.0.0.1:8766') {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="harmony"]').click();
  await page.locator('#btn-edit-harmony-toggle').click();
  await page.locator('[title="Transform"]').first().click();
  const modal=page.locator('#transformer-modal');
  const input=path=>page.locator(`[data-setting="${path}"]`);
  assert.equal(await input('circle.edgeWidth').inputValue(),'6');
  for(const [target,source] of [['#tf-show-panel','#btn-toggle-config'],['#tf-collapse','#panel-toggle']])
    assert.equal(await page.locator(`${target} svg`).innerHTML(),await page.locator(`${source} svg`).innerHTML());
  const hideBox=await page.locator('#tf-collapse').boundingBox();
  await page.locator('#tf-collapse').click();
  assert.deepEqual(await page.locator('#tf-show-panel').boundingBox(),hideBox);
  await page.locator('#tf-show-panel').click();
  async function drag(selector,dx,dy) {
    const box=await page.locator(selector).boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:8});
    await page.mouse.up();
  }
  let before=await modal.boundingBox();
  await drag('.tf-resize-se',-180,-100);
  let after=await modal.boundingBox();
  assert.ok(Math.abs(after.width-before.width+180)<2);
  assert.ok(Math.abs(after.height-before.height+100)<2);
  before=after;
  await drag('.tf-resize-e',-40,0); after=await modal.boundingBox();
  assert.ok(Math.abs(after.width-before.width+40)<2);
  before=after;
  await drag('.tf-resize-s',0,-40); after=await modal.boundingBox();
  assert.ok(Math.abs(after.height-before.height+40)<2);
  before=after;
  await drag('#tf-title',70,45); after=await modal.boundingBox();
  assert.ok(Math.abs(after.x-before.x-70)<2);
  assert.ok(Math.abs(after.y-before.y-45)<2);

  await page.locator('#tf-tones').fill('1, 5/4, 3/2');
  for(const prefix of ['Schritt','Wechsel']) {
    for(const name of ['Label','Shape','Style','Geometry'])
      await page.locator('summary').filter({hasText:new RegExp(`^${prefix} ${name}$`)}).click();
    assert.equal(await page.locator('summary').filter({hasText:new RegExp(`^${prefix} Rotation$`)}).count(),0);
  }
  const groups={
    label:{labelFontSize:'18',labelColor:'#123456'},
    shape:{keySize:'150',keyShape:'hex',uniformColor:'#abcdef',edgeColor:'#102030',keyStrokeWidth:'3',opacity:'0.7'},
    style:{keyRounding:'0.35',keyEdge:'convex',keyBulge:'0.45'},
    geometry:{keyRotation:'30',keyStretchX:'1.4',keyStretchY:'0.8',keyOffsetX:'12',keyOffsetY:'-9'}
  };
  const expected={labelColor:'#edcba9',uniformColor:'#543210',edgeColor:'#efdfcf',
    keyRotation:'-150',keyOffsetX:'-12',keyOffsetY:'9'};
  for(const [group,values] of Object.entries(groups)) {
    await page.locator(`[data-sync-toggle="${group}"]`).click();
    assert.equal(await page.locator(`[data-sync-toggle="${group}"]`).getAttribute('aria-pressed'),'true');
    for(const [prop,value] of Object.entries(values)) {
      const control=input(`schritt.${prop}`);
      if(prop==='keyShape'||prop==='keyEdge') await control.selectOption(value);
      else await control.fill(value);
      assert.equal(await input(`wechsel.${prop}`).isDisabled(),true);
      assert.equal(await input(`wechsel.${prop}`).inputValue(),expected[prop]??value);
    }
  }
  // The range input changes the same value as the adjacent fine-number input.
  const slider=page.locator('[data-slider="schritt.keyRotation"]');
  await slider.focus(); await slider.press('ArrowRight');
  assert.equal(await input('schritt.keyRotation').inputValue(),'31');
  assert.equal(await input('wechsel.keyRotation').inputValue(),'-149');
  // Unlinking preserves the derived values and enables edits; reset is one-shot.
  await page.locator('[data-sync-toggle="label"]').click();
  assert.equal(await input('wechsel.labelColor').isEnabled(),true);
  await input('wechsel.labelColor').fill('#aaaaaa');
  await page.locator('[data-sync-reset="label"]').click();
  assert.equal(await input('wechsel.labelColor').inputValue(),'#edcba9');
  await input('schritt.labelColor').fill('#010203');
  assert.equal(await input('wechsel.labelColor').inputValue(),'#edcba9');
  await page.locator('#tf-save').click();
  await page.locator('#tf-close').click();
  await page.locator('[title="Transform"]').first().click();
  assert.equal(await page.locator('[data-sync-toggle="geometry"]').getAttribute('aria-pressed'),'true');
  assert.equal(await input('wechsel.keyRotation').isDisabled(),true);

  await page.locator('.tf-point[data-monomial="bc"]').click();
  await page.getByRole('button',{name:'Show neighborhood',exact:true}).click();
  await page.locator('.tf-point[data-monomial="b^2c/a"]').click();
  await page.getByRole('button',{name:'Show neighborhood',exact:true}).click();
  for(const [depth,width] of [[0,6],[1,3.6],[2,2.16]]) {
    const circle=page.locator(`.tf-circle[data-depth="${depth}"]`).first();
    assert.ok(Math.abs(Number(await circle.getAttribute('stroke-width'))-width)<1e-8);
  }
  const root=page.locator('.tf-point[data-depth="0"]').first();
  const child=page.locator('.tf-point[data-depth="1"]').first();
  assert.ok(Number(await child.getAttribute('opacity'))<Number(await root.getAttribute('opacity')));
  await page.locator('.tf-point[data-monomial="bc"]').first().hover();
  assert.equal(await page.locator('.tf-circle.tf-emphasized').count(),3);
  assert.equal(await page.locator('.tf-point.tf-emphasized').count(),13);
  const count=await page.locator('.tf-point').count();
  await page.locator('.tf-point[data-monomial="a/b"]').first().hover();
  assert.equal(await page.locator('[data-layer="hover-preview"] > circle').count(),16);
  assert.equal(await page.locator('.tf-point').count(),count);
  await page.locator('.tf-tone-label[data-depth="0"][data-tone-index="0"]').hover();
  assert.equal(await page.locator('[data-layer="hover-preview"]').count(),0);
  assert.equal(await page.locator('.tf-circle.tf-emphasized').count(),1);
  assert.equal(await page.locator('.tf-point.tf-emphasized').count(),6);
  await page.locator('#tf-title').hover();
  assert.equal(await page.locator('.tf-emphasized').count(),0);
  // Invalid tones must not strand either floating configuration toggle.
  await page.locator('#tf-tones').fill('invalid');
  await page.locator('#tf-collapse').click();
  assert.equal(await page.locator('#tf-panel').isVisible(),false);
  await page.locator('#tf-show-panel').click();
  await page.locator('#tf-reset').click();
  assert.equal(await page.locator('.tf-point').count(),13);
  await page.setViewportSize({width:375,height:812});
  await page.locator('#tf-collapse').click();
  assert.equal(await page.locator('#tf-show-panel').isVisible(),true);
  await page.locator('#tf-show-panel').click();
  await page.setViewportSize({width:1440,height:960});
  assert.equal(await page.locator('#tf-close').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS Transformer resize/drag, floating icons, sliders, inverse sync, depth and hover');
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
