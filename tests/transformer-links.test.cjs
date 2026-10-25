const assert=require('node:assert/strict');
async function run(page,url='http://127.0.0.1:8766') {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.svg-key').first().waitFor();
  await page.locator('[data-tab="harmony"]').click();await page.locator('#btn-edit-harmony-toggle').click();
  await page.locator('[title="Transform"]').first().click();
  await page.locator('#tf-tones').fill('1, 5/4, 3/2');await page.locator('#tf-name').fill('Links');
  await page.locator('.tf-point[data-monomial="a/b"]').click();
  await page.getByRole('button',{name:'Transport to keyboard',exact:true}).click();
  await page.locator('#app-confirm-dialog [data-confirm]').click();
  await page.locator('#tf-point-menu [aria-label="Close actions"]').click();
  await page.locator('#tf-close').click();
  const transported=page.locator('#harmony-list .transported-harmony');
  await transported.click();await page.locator('#he-color').fill('#abcdef');
  await transported.locator('[title="Transform"]').click();
  await page.locator('[data-tf-tab="harmony"]').click();
  await page.locator('#tf-tones').fill('1, 4/3, 5/3');await page.locator('#tf-name').fill('Renamed');
  await page.locator('#tf-save').click();
  assert.equal(await page.evaluate(()=>harmonies[1].ratios),'1, 5/4, 3/2');
  assert.equal(await page.evaluate(()=>harmonies[1].name),'a/b of Renamed');
  assert.equal(await page.evaluate(()=>harmonies[1].uniformColor),'#abcdef');
  await page.locator('#tf-mode').selectOption('vectors');
  await page.locator('#tf-save').click();
  assert.equal(await page.evaluate(()=>harmonies[1].toneMode),'vectors');
  assert.ok((await page.evaluate(()=>harmonies[1].ratios)).includes('('));
  const json=await page.evaluate(()=>buildProjectJSON());
  await page.locator('#tf-close').click();
  await page.locator('[data-tab="project"]').click();
  await page.locator('#import-harmonies-file').setInputFiles({name:'links.json',mimeType:'application/json',buffer:Buffer.from(json)});
  await page.locator('#btn-import-harmonies-confirm').click();
  assert.equal(await page.evaluate(()=>harmonies.length),4);
  assert.equal(await page.evaluate(()=>harmonies[3].transport.sourceId===harmonies[2].id),true);
  assert.equal(await page.evaluate(()=>harmonies[3].transport.sourceId!==harmonies[0].id),true);
  await page.locator('[data-tab="harmony"]').click();
  const originalSource=await page.evaluate(()=>harmonies[0].id);
  await page.locator(`#harmony-list .harmony-item[data-id="${originalSource}"] [title="Delete"]`).click();
  await page.locator('#app-confirm-dialog [data-confirm]').click();
  assert.equal(await page.evaluate(()=>harmonies.length),2);
  assert.equal(await page.locator('#harmony-list .transported-harmony').count(),1);
  // A partial import without the source is detached rather than linked to an unrelated existing ID.
  await page.locator('[data-tab="project"]').click();
  await page.locator('#import-harmonies-file').setInputFiles({name:'partial.json',mimeType:'application/json',buffer:Buffer.from(json)});
  await page.locator('#ih-cb-0').uncheck();
  await page.locator('#btn-import-harmonies-confirm').click();
  assert.equal(await page.evaluate(()=>harmonies.length),3);
  assert.equal(await page.evaluate(()=>harmonies.at(-1).transport),null);
  await page.locator('[data-tab="harmony"]').click();
  assert.equal(await page.locator('#he-name').isEditable(),true);
  assert.equal(await page.locator('#he-invert-btn').isVisible(),true);
  // A clone of a transported harmony is an ordinary independent harmony.
  await page.locator('#harmony-list .transported-harmony [title="Clone"]').click();
  assert.equal(await page.evaluate(()=>harmonies.at(-1).transport),null);
  assert.equal(await page.locator('#he-ratios').isEditable(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS transported source updates, retained designs, batch remapping, orphan handling and clones');
}
module.exports=run;
if(require.main===module) {
  (async()=>{
    const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,channel:'chromium'});
    try{await run(await browser.newPage({viewport:{width:1440,height:960}}),process.argv[2]);}finally{await browser.close();}
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
