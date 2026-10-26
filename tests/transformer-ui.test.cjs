// Requires Playwright and a running static server. CLI: node tests/transformer-ui.test.cjs [url]
const assert = require('node:assert/strict');

async function run(page, url = 'http://127.0.0.1:8766') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => {
    if (d.message().startsWith('Unsaved changes. Save before')) return d.dismiss();
    if (d.type() === 'prompt') return d.accept('1, 3/2');
    return d.accept();
  });
  await page.goto(url, {waitUntil:'domcontentloaded'});
  await page.locator('.svg-key').first().waitFor();
  for (const tab of ['project','layout','view','sound','info','harmony']) {
    await page.locator(`[data-tab="${tab}"]`).click();
    assert.equal(await page.locator(`#tab-${tab}`).isVisible(),true);
  }
  assert.equal(await page.locator('[title="Transform"]').count(),0);
  await page.locator('#btn-edit-harmony-toggle').click();
  await page.locator('[title="Transform"]').first().click();
  assert.equal(await page.locator('#transformer-modal').isVisible(),true);
  assert.equal(await page.locator('.tf-point').count(),93);
  await page.locator('#tf-tones').fill('1, 5/4, 3/2');
  assert.equal(await page.locator('.tf-point').count(),13);
  await page.locator('[data-op="multiply"]').click();
  assert.equal(await page.locator('#tf-tones').inputValue(),'1, 3/2, 5/4, 15/8, 9/4');
  await page.locator('#tf-tones').fill('1, 5/4, 3/2');
  await page.locator('#tf-name').fill('Triangle QA');
  assert.notEqual(await page.evaluate(()=>harmonies[0].name),'Triangle QA');
  await page.locator('.tf-point[data-monomial="bc"]').click();
  await page.getByRole('button',{name:'Pin neighborhood',exact:true}).click();
  await page.locator('#tf-point-menu [aria-label="Close actions"]').click();
  await page.locator('#tf-fit').click();
  assert.equal(await page.locator('.tf-point').count(),25);
  assert.equal(await page.locator('.tf-point[data-monomial="b^2c/a"]').count(),1);
  await page.locator('.tf-point[data-monomial="b^2c/a"]').click();
  await page.getByRole('button',{name:'Pin neighborhood',exact:true}).click();
  await page.locator('#tf-point-menu [aria-label="Close actions"]').click();
  await page.locator('#tf-fit').click();
  assert.equal(await page.locator('.tf-point').count(),37);
  await page.locator('.tf-point[data-monomial="bc"][data-depth="0"]').click();
  await page.getByRole('button',{name:'Unpin neighborhood',exact:true}).click();
  await page.locator('#tf-point-menu [aria-label="Close actions"]').click();
  assert.equal(await page.locator('.tf-point').count(),26);
  await page.locator('[data-tf-tab="pinned"]').click();
  await page.locator('#tf-pane-pinned > .tf-collection [title="Unpin neighborhood"]').click();
  assert.equal(await page.locator('.tf-point').count(),13);
  await page.locator('[data-tf-tab="layout"]').click();
  await page.locator('[data-setting="showSchritts"]').uncheck();
  assert.equal(await page.locator('.tf-point').count(),7);
  await page.locator('[data-setting="showSchritts"]').check();
  await page.locator('[data-setting="flipSchritts"]').check();
  await page.locator('[data-setting="secondarySize"]').fill('180');
  assert.equal(await page.locator('[data-layer="circles"] circle').count(),6);
  await page.locator('[data-setting="showCollapses"]').check();
  await page.locator('[data-setting="collapses.edgeWidth"]').fill('3');
  await page.locator('[data-setting="collapses.edgeColor"]').fill('#cc4422');
  await page.locator('[data-setting="toneLabels.type"]').selectOption('ratio');
  await page.locator('[data-setting="toneLabels.fontSize"]').fill('15');
  await page.locator('[data-setting="toneLabels.offset"]').fill('8');
  await page.locator('[data-setting="toneLabels.show"]').uncheck();
  assert.equal(await page.locator('[data-layer="tone-labels"] > *').count(),0);
  await page.locator('[data-setting="toneLabels.show"]').check();
  await page.locator('[data-tf-tab="design"]').click();
  for (const type of ['schritt','wechsel']) {
    const title = type === 'schritt' ? 'Schritt' : 'Wechsel';
    if(type==='wechsel') {
      for(const group of ['label','shape','style','geometry'])
        await page.locator(`[data-sync-toggle="${group}"]`).click();
    }
    for (const section of ['Label','Shape','Style','Geometry']) {
      await page.locator('#tf-options summary').filter({hasText:new RegExp(`^${title} ${section}$`)}).click();
    }
    const values = {labelFontSize:'16',labelColor:'#112233',keySize:'140',uniformColor:'#e5d7a8',
      edgeColor:'#223344',keyStrokeWidth:'2',opacity:'0.8',keyRounding:'0.3',keyBulge:'0.4',
      keyRotation:'35',keyStretchX:'1.2',keyStretchY:'0.8',keyOffsetX:'8',keyOffsetY:'-10'};
    for (const [prop,value] of Object.entries(values))
      await page.locator(`[data-setting="${type}.${prop}"]`).fill(value);
    await page.locator(`[data-setting="${type}.keyShape"]`).selectOption('triangle');
    await page.locator(`[data-setting="${type}.keyEdge"]`).selectOption('convex');
  }
  assert.equal(await page.locator('#tf-reset-style').count(),0);
  assert.equal(await page.locator('[data-setting="secondarySize"]').inputValue(),'180');
  assert.equal(await page.locator('[data-setting="flipSchritts"]').isChecked(),true);
  await page.locator('[data-tf-tab="harmony"]').click();
  await page.locator('#tf-mode').selectOption('vectors');
  assert.ok((await page.locator('#tf-tones').inputValue()).includes('(-2, 0, 1)'));
  await page.locator('[data-op="invert"]').click();
  await page.locator('[data-op="reduce"]').click();
  assert.equal(await page.locator('#tf-tones').inputValue(),'(0, 0), (2, -1), (3, 0, -1)');
  await page.locator('#tf-mode').selectOption('ratios');
  await page.locator('[data-op="simplify"]').click();
  assert.equal(await page.locator('[data-op="simplify"]').textContent(),'Original');
  await page.locator('[data-op="simplify"]').click();
  await page.locator('#tf-tones').fill('1, 5/4, 3/2');
  await page.locator('.tf-point[data-monomial="bc"]').click();
  await page.getByRole('button',{name:'Pin neighborhood',exact:true}).click();
  await page.locator('#tf-point-menu [aria-label="Close actions"]').click();
  await page.locator('#tf-save').click();
  assert.equal(await page.evaluate(()=>harmonies[0].name),'Triangle QA');
  await page.locator('.tf-point[data-monomial="a/b"][data-depth="0"]').click();
  await page.getByRole('button',{name:'Transport to keyboard',exact:true}).click();
  assert.equal(await page.evaluate(()=>harmonies.at(-1).name),'a/b of Triangle QA');
  assert.equal(await page.evaluate(()=>harmonies.at(-1).ratios),'1, 6/5, 8/5');
  const json = await page.evaluate(()=>buildProjectJSON());
  assert.equal(JSON.parse(json).harmonies[0].transformer.expanded.length,1);
  await page.locator('#tf-close').click();
  await page.locator('#import-file').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(json)});
  await page.locator('[data-tab="harmony"]').click();
  await page.locator('[title="Transform"]').first().click();
  assert.equal(await page.locator('#tf-name').inputValue(),'Triangle QA');
  assert.equal(await page.locator('.tf-point').count(),25);
  await page.locator('#tf-tones').fill('invalid');
  assert.equal(await page.locator('#tf-message').getAttribute('class'),'tf-error');
  await page.locator('#tf-reset').click();
  assert.equal(await page.locator('.tf-point').count(),25);
  await page.locator('#tf-collapse').click();
  assert.equal(await page.locator('#tf-panel').isVisible(),false);
  await page.locator('#tf-show-panel').click();
  assert.equal(await page.locator('#tf-panel').isVisible(),true);
  await page.locator('#tf-close').click();
  await page.locator('[data-tab="layout"]').click();
  await page.locator('#global-octave-equiv').uncheck();
  await page.locator('[data-tab="harmony"]').click();
  assert.equal(await page.locator('[title="Transform"]').count(),0);
  await page.locator('[data-tab="layout"]').click();
  await page.locator('#global-octave-equiv').check();
  await page.locator('[data-tab="harmony"]').click();
  assert.equal(await page.locator('[title="Transform"]').count(),2);
  await page.locator('#btn-hide-all-harmonies').click();
  assert.equal(await page.locator('.svg-key').count(),0);
  await page.locator('#btn-show-all-harmonies').click();
  assert.ok(await page.locator('.svg-key').count()>0);
  await page.locator('.svg-key').filter({visible:true}).first().click({force:true}).catch(async()=>{
    await page.locator('#btn-zoom-in').click();
  });
  await page.locator('[data-tab="sound"]').click();
  await page.locator('#btn-test-sound').click();
  await page.locator('[data-tab="project"]').click();
  await page.locator('#btn-new-project').click();
  assert.equal(await page.locator('#tab-harmony').isVisible(),true);
  await page.locator('[title="Transform"]').first().click();
  assert.ok((await page.locator('#tf-message').textContent()).includes('Enter at least one tone'));
  await page.locator('#tf-tones').fill('1, 5/4, 3/2');
  await page.locator('#tf-save').click();
  await page.locator('#tf-close').click();
  assert.deepEqual(errors,[]);
  console.log('PASS Transformer browser flows, persistence and keyboard regressions');
}
module.exports = run;
if (require.main === module) {
  (async()=>{
    const {chromium}=require('playwright');
    const browser=await chromium.launch({headless:true,channel:'chromium'});
    try { await run(await browser.newPage({viewport:{width:1440,height:960}}),process.argv[2]); }
    finally { await browser.close(); }
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
