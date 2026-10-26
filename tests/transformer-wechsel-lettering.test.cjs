const assert=require('node:assert/strict');
async function run(page,url='http://127.0.0.1:8766') {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.svg-key').first().waitFor();
  await page.locator('[data-tab="harmony"]').click();await page.locator('#btn-edit-harmony-toggle').click();
  await page.locator('[title="Transform"]').first().click();
  await page.locator('#tf-tones').fill('1,3/2,5/4');
  // Explicit source assignment from the user's example, not pitch-ranked defaults.
  await page.getByLabel('Letter for 5/4',{exact:true}).fill('z');
  await page.getByLabel('Letter for 3/2',{exact:true}).fill('b');
  await page.getByLabel('Letter for 5/4',{exact:true}).fill('c');
  await page.locator('[data-tf-tab="layout"]').click();
  await page.locator('[data-setting="toneLabels.type"]').selectOption('ratio');
  await page.locator('#tf-save').click();
  const checkTable=async selector=>{
    const table=page.locator(`${selector} .tone-table`);
    assert.deepEqual(await table.locator('th').allTextContents(),['Letter','Tone','Name','¢','Hz']);
    const rows=await table.locator('tbody tr').evaluateAll(es=>es.map(e=>[
      e.cells[0].textContent.trim(),e.querySelector('.tf-tone-value > span').textContent.trim()
    ]));
    assert.deepEqual(Object.fromEntries(rows),{a:'3/2',b:'1',c:'6/5'});
    assert.equal(await table.locator('.tf-tone-value > svg').count(),3);
  };
  await page.locator('.tf-point[data-monomial="ab"]').click();
  await checkTable('#tf-point-menu');
  await page.locator('#tf-point-menu [data-action="pin"]').click();
  assert.deepEqual((await page.locator('.tf-tone-label[data-depth="1"]').allTextContents()).sort(),
    ['a = 3/2','b = 1','c = 6/5'].sort());
  await page.locator('#tf-point-menu [aria-label="Pin panel"]').click();
  await checkTable('.tf-pinned-panel');
  await page.locator('[data-tf-tab="transformations"]').click();
  const row=page.locator('#tf-pane-transformations .tf-list-item[data-monomial="ab"]');
  await row.click();await checkTable('#tf-pane-transformations');
  await row.locator('[data-action="transport"]').click();
  await page.locator('[data-tf-tab="transported"]').click();
  const transported=page.locator('#tf-pane-transported .tf-list-item');
  if(!await transported.evaluate(e=>e.classList.contains('selected')))await transported.click();
  await checkTable('#tf-pane-transported');
  await page.locator('#tf-save').click();await page.locator('#tf-close').click();
  assert.deepEqual(await page.locator('#harmony-editor .tone-table th').allTextContents(),
    ['','Tone','Name','¢','Hz','W']);
  assert.deepEqual(errors,[]);
}
module.exports=run;
if(require.main===module)(async()=>{
  const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,channel:'chromium'});
  try{await run(await browser.newPage({viewport:{width:1440,height:960}}),process.argv[2]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
