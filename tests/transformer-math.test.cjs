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
test('pinned and nested neighborhoods share a single transformation frame', `
  for (var [raw,mode] of [
    ['1, 5/4, 3/2','ratios'],['7/6, 11/8, 13/8','ratios'],
    ['(0,0), (-2,0,1), (-1,1)','vectors'],
    ['(0,0), (1/2,0), (-1,1)','vectors']
  ]) {
    var frameTones=TransformerMath.parse(raw,mode);
    for(var rotation of [0,37,-123,360]) {
      var frameSettings={circle:{size:287,rotation},showSchritts:true,flipSchritts:false,secondarySize:175};
      var frameOrigin=[71,-43];
      var rootScene=TransformerMath.neighborhood(frameTones,TransformerMath.identity(3),frameOrigin,frameSettings);
      var basis=rootScene.circles.map(c=>c.center.map((x,k)=>x-frameOrigin[k]));
      var positions=new Map();
      function checkFrame(scene) {
        scene.nodes.forEach(n=>{
          var expected=frameOrigin.map((x,k)=>x+n.op.q.reduce((sum,e,i)=>sum+e*basis[i][k],0));
          assert.ok(Math.hypot(n.point[0]-expected[0],n.point[1]-expected[1])<1e-7,
            'wrong position for '+TransformerMath.opKey(n.op));
          var key=TransformerMath.opKey(n.op), previous=positions.get(key);
          if(previous) assert.ok(Math.hypot(n.point[0]-previous[0],n.point[1]-previous[1])<1e-7,
            'shared transformation moved: '+key);
          positions.set(key,n.point);
          if(n.slot.startsWith('w:')) {
            n.slot.split(':').slice(1).forEach(i=>{
              var center=scene.circles[Number(i)].center;
              assert.ok(Math.abs(Math.hypot(n.point[0]-center[0],n.point[1]-center[1])-287)<1e-7);
            });
          }
        });
      }
      checkFrame(rootScene);
      for(var anchor of rootScene.nodes) {
        var childScene=TransformerMath.neighborhood(frameTones,anchor.op,anchor.point,frameSettings);
        checkFrame(childScene);
        for(var next of childScene.nodes)
          checkFrame(TransformerMath.neighborhood(frameTones,next.op,next.point,frameSettings));
      }
    }
  }
`);
test('identity in Wechsel ab returns to the primary origin in either Schritt display mode', `
  for(var flip of [false,true]) {
    var cfg={circle:{size:300,rotation:23},showSchritts:true,flipSchritts:flip,secondarySize:175};
    var base=TransformerMath.neighborhood(tones,id,[0,0],cfg);
    var ab=base.nodes.find(n=>n.slot==='w:0:1');
    var pinned=TransformerMath.neighborhood(tones,ab.op,ab.point,cfg);
    var back=pinned.nodes.find(n=>n.slot==='w:0:1');
    assert.equal(TransformerMath.opKey(back.op),TransformerMath.opKey(id));
    assert.ok(Math.hypot(...back.point)<1e-7);
  }
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
test('letters follow original pitches and can label monomials independently of operation indices', `
  var original=TransformerMath.parse('5, 1, 3','ratios');
  assert.equal(original.find(t=>t.sourceDisplay==='1').letter,'a');
  assert.equal(original.find(t=>t.sourceDisplay==='3').letter,'b');
  assert.equal(original.find(t=>t.sourceDisplay==='5').letter,'c');
  var indexes=original.map(t=>t.key);
  assert.equal(TransformerMath.monomial({q:[0,1,1],inverted:true},original),'bc');
  original.find(t=>t.sourceDisplay==='3').letter='β';
  assert.equal(TransformerMath.monomial({q:[1,0,1],inverted:true},original),'aβ');
  assert.deepEqual(original.map(t=>t.key),indexes);
  var duplicate=TransformerMath.parse('6, 1, 3, 5','ratios');
  assert.equal(duplicate.find(t=>t.key==='3/2').sourceDisplay,'3');
  var vectorLetters=TransformerMath.parse('(0,0,1), (0,0), (0,1)','vectors');
  assert.deepEqual(Array.from(vectorLetters,t=>t.letter),['a','c','b']);
`);
