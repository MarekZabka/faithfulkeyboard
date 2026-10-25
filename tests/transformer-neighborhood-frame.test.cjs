const assert=require('node:assert/strict');

async function run(page,url='http://127.0.0.1:8766') {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('.svg-key').first().waitFor();
  await page.locator('[data-tab="harmony"]').click();
  await page.locator('#btn-edit-harmony-toggle').click();
  await page.locator('[title="Transform"]').first().click();
  await page.locator('#tf-tones').fill('1, 5/4, 3/2');
  const pointData=selector=>page.locator(selector).evaluateAll(es=>es.map(e=>{
    const shape=e.querySelector('circle,ellipse');
    return {op:e.dataset.op,scene:e.dataset.scene,monomial:e.dataset.monomial,
      point:[Number(shape.getAttribute('cx')),Number(shape.getAttribute('cy'))]};
  }));
  async function aligned() {
    const rows=await pointData('.tf-point'),seen=new Map();
    let shared=0;
    for(const row of rows) {
      const previous=seen.get(row.op);
      if(previous) {
        shared++;
        assert.ok(Math.hypot(...row.point.map((x,i)=>x-previous[i]))<1e-6,
          `${row.op} differs across neighborhoods`);
      } else seen.set(row.op,row.point);
    }
    assert.ok(shared>=4);
    const identities=rows.filter(n=>n.op==='s:0,0,0');
    assert.ok(identities.length>=2);
    identities.forEach(n=>assert.ok(Math.hypot(...n.point)<1e-6));
  }
  // The temporary hover preview must use the same frame as a pinned neighborhood.
  await page.locator('.tf-point[data-monomial="ab"]').hover();
  await page.locator('.tf-preview-point[data-monomial="1"]').waitFor();
  const preview=await pointData('.tf-preview-point[data-monomial="1"]');
  assert.ok(Math.hypot(...preview[0].point)<1e-6);
  await page.locator('[data-tf-tab="transformations"]').click();
  const camera=await page.locator('#tf-diagram').getAttribute('viewBox');
  await page.locator('#tf-pane-transformations .tf-list-item[data-monomial="ab"] [data-action="pin"]').click();
  await aligned();
  assert.equal(await page.locator('#tf-diagram').getAttribute('viewBox'),camera);
  assert.notEqual(await page.locator('.tf-tone-label[data-depth="0"][data-tone-index="0"] > rect')
    .getAttribute('fill'),'transparent');
  // Primary markers must remain genuine mouse targets above overlapping aliases.
  await page.locator('.tf-point[data-monomial="1"][data-depth="0"]').click();
  assert.equal(await page.locator('#tf-point-menu .tf-menu-action').count(),0);
  await page.locator('#tf-point-menu [aria-label="Close actions"]').click();
  // Reach a unique Wechsel through the pinned ab neighborhood, then pin it too.
  await page.locator('.tf-point[data-monomial="a^2b/c"]').press('Enter');
  await page.locator('#tf-point-menu [aria-label="Pin neighborhood"]').click();
  await page.locator('#tf-point-menu [aria-label="Close actions"]').click();
  await aligned();
  await page.locator('[data-tf-tab="layout"]').click();
  for(const angle of ['37','-123']) {
    await page.locator('[data-setting="circle.rotation"]').fill(angle);
    await aligned();
  }
  await page.locator('[data-setting="circle.size"]').fill('420');
  await aligned();
  await page.locator('#tf-save').click();
  const json=await page.evaluate(()=>buildProjectJSON());
  await page.locator('#tf-close').click();
  await page.locator('#import-file').setInputFiles({
    name:'neighborhood-frame.json',mimeType:'application/json',buffer:Buffer.from(json)
  });
  await page.locator('[data-tab="harmony"]').click();
  await page.locator('[title="Transform"]').first().click();
  await aligned();
  assert.deepEqual(errors,[]);
}

module.exports=run;
if(require.main===module) {
  (async()=>{
    const {chromium}=require('playwright');
    const browser=await chromium.launch({headless:true,channel:'chromium'});
    try {
      await run(await browser.newPage({viewport:{width:1440,height:960}}),process.argv[2]);
    } finally {await browser.close();}
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
