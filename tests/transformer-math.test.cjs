const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({console});
const read = name => fs.readFileSync(path.join(root, 'js', name), 'utf8');
vm.runInContext(read('math.js') + '\n' + read('tones.js') + '\n' +
  read('ui-project.js').split('//  PROJECT NAME')[0] + '\n' + read('transformer-math.js'), context);
function test(name, code) {
  vm.runInContext(code, context);
  console.log('PASS', name);
}
context.assert = assert;
test('octave normalization and exact deduplication', `
  var tones = TransformerMath.parse('1, 5/4, 3/2, 2, 3, 5/2', 'ratios');
  assert.equal(tones.length, 3);
  assert.equal(tones.map(t => t.display).join(','), '1,5/4,3/2');
  assert.equal(TransformerMath.parse('4/7','ratios')[0].display,'8/7');
`);
test('Schritt image is multiplication; Wechsel image is inversion', `
  var id = TransformerMath.identity(3);
  var step = TransformerMath.local(3,1,0,false);
  var change = TransformerMath.local(3,1,2,true);
  assert.equal(TransformerMath.imageText(tones, step, 'ratios'),'5/4, 25/16, 15/8');
  assert.equal(TransformerMath.imageText(tones, change, 'ratios'),'5/4, 3/2, 15/8');
`);
test('all four monomial composition rules', `
  var s1={q:[1,-1,0],inverted:false}, s2={q:[0,1,-1],inverted:false};
  var w1={q:[1,1,0],inverted:true}, w2={q:[0,1,1],inverted:true};
  assert.equal(TransformerMath.monomial(TransformerMath.compose(s1,s2)),'a/c');
  assert.equal(TransformerMath.monomial(TransformerMath.compose(w1,s2)),'ab^2/c');
  assert.equal(TransformerMath.monomial(TransformerMath.compose(s1,w2)),'b^2c/a');
  assert.equal(TransformerMath.monomial(TransformerMath.compose(w1,w2)),'c/a');
  assert.equal(TransformerMath.compose(w1,w2).inverted,false);
  assert.equal(TransformerMath.compose(s1,w2).inverted,true);
`);
test('nested operations equal applying local transformation to parent image', `
  for (var parentOp of [s1,w1,w2]) for(var localOp of [s1,s2,w1,w2]) {
    var parentTones=TransformerMath.image(tones,parentOp);
    var lhs=TransformerMath.image(parentTones,localOp);
    var rhs=TransformerMath.image(tones,TransformerMath.compose(localOp,parentOp));
    assert.equal(lhs.map(t=>t.display).join('|'),rhs.map(t=>t.display).join('|'));
  }
`);
test('geometry reproduces circle intersections and origin', `
  var settings={circle:{size:300,rotation:0},showSchritts:true,flipSchritts:false,secondarySize:300};
  var scene=TransformerMath.neighborhood(tones,id,[0,0],settings);
  assert.equal(scene.nodes.length,13);
  assert.equal(scene.circles.length,3);
  scene.nodes.filter(n=>n.op.inverted).forEach(n=>{
    var [,i,j]=n.slot.split(':').map(Number);
    [i,j].forEach(k=>{
      var c=scene.circles[k].center;
      assert.ok(Math.abs(Math.hypot(n.point[0]-c[0],n.point[1]-c[1])-300)<1e-7);
    });
  });
  assert.equal(scene.nodes[0].point.join(','),'0,0');
`);
test('flip Schritts uses secondary circles of chosen size', `
  settings.flipSchritts=true;settings.secondarySize=175;
  var flipped=TransformerMath.neighborhood(tones,id,[0,0],settings);
  flipped.nodes.filter(n=>n.slot.startsWith('s:')).forEach(n=>{
    var i=Number(n.slot.split(':')[1]), c=flipped.circles[3+i].center;
    assert.ok(Math.abs(Math.hypot(n.point[0]-c[0],n.point[1]-c[1])-175)<1e-7);
  });
`);
test('fractional exponent vectors and negative octaves', `
  var vectors=TransformerMath.parse('(0,0), (-2,0,1), (-1,1), (1,0)', 'vectors');
  assert.equal(vectors.length,3);
  assert.equal(TransformerMath.imageText(vectors,TransformerMath.identity(3),'ratios'),'1, 5/4, 3/2');
  var fractional=TransformerMath.parse('(1/2,0),(-5/2,0)', 'vectors');
  assert.equal(fractional.length,1);
  assert.ok(Math.abs(fractional[0].log-.5)<1e-10);
`);
test('invalid inputs fail safely', `
  for(var raw of ['','0','-1','1/0','garbage']) {
    assert.throws(()=>TransformerMath.parse(raw,'ratios'));
  }
`);
