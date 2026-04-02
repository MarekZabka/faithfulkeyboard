// math.js
// Pure math: ratios, primes, matrix operations. No DOM, no state.
// ======================================================================


// ═════════════════════════════════════════════════════════════════════════════
//  MATH UTILITIES
// ═════════════════════════════════════════════════════════════════════════════

function gcd(a, b) { a=Math.abs(a); b=Math.abs(b); while(b){[a,b]=[b,a%b];} return a; }

function parseRatio(s) {
  s = s.trim();
  if (!s) return null;
  // support exponent tuple like [1,-1,0,0,0,0]
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return { expsOverride: arr.map(Number) };
    } catch(e) {}
  }
  if (s.includes('/')) {
    const [n,d] = s.split('/').map(x=>parseInt(x.trim()));
    if (isNaN(n)||isNaN(d)||d===0) return null;
    const g = gcd(Math.abs(n),Math.abs(d));
    return { num: n/g, den: d/g };
  }
  const v = parseFloat(s);
  if (isNaN(v)||v<=0) return null;
  const den=1000; const num=Math.round(v*den); const g=gcd(num,den);
  return { num: num/g, den: den/g };
}

function ratioVal(r) { return r.num/r.den; }
function ratioToCents(r) { return 1200*Math.log2(ratioVal(r)); }

function reduceOctave(r) {
  let v=ratioVal(r), num=r.num, den=r.den;
  while(v>=2){num/=2;v/=2;}
  while(v<1){num*=2;v*=2;}
  const factor=den;
  let n=Math.round(num*factor), d=Math.round(den*factor);
  const g=gcd(Math.abs(n),Math.abs(d));
  return {num:n/g, den:d/g};
}

const PRIMES=[2,3,5,7,11,13];
function factorize(n) {
  const exps=new Array(PRIMES.length).fill(0);
  if(n===0) return exps;
  for(let i=0;i<PRIMES.length;i++) while(n%PRIMES[i]===0){exps[i]++;n/=PRIMES[i];}
  return exps;
}
function ratioExponents(r) {
  if (r.expsOverride) return r.expsOverride.concat(new Array(Math.max(0,6-r.expsOverride.length)).fill(0));
  const en=factorize(r.num), ed=factorize(r.den);
  return en.map((e,i)=>e-ed[i]);
}
function jiLimit(r) {
  const exps=ratioExponents(r); let lim=1;
  for(let i=0;i<PRIMES.length;i++) if(exps[i]!==0) lim=Math.max(lim,PRIMES[i]);
  return lim;
}

const H_VEC = PRIMES.map(p=>1200*Math.log2(p));
function expsToHeight(exps) { return exps.reduce((s,e,i)=>s+e*H_VEC[i],0); }
function expsToWidth(exps, wVec) { return exps.reduce((s,e,i)=>s+e*(wVec[i]||0),0); }
function formatRatio(r) { if(r.den===1) return `${r.num}`; return `${r.num}/${r.den}`; }

// Dot product
function dot(a,b) { return a.reduce((s,v,i)=>s+v*(b[i]||0),0); }

// Matrix-vector product
function matVec(M, v) { return M.map(row => dot(row, v)); }

// ═════════════════════════════════════════════════════════════════════════════
//  MATRIX UTILITIES
// ═════════════════════════════════════════════════════════════════════════════

// Invert a 6x6 matrix using Gaussian elimination. Returns null if singular.
function invertMatrix6(M) {
  const n = 6;
  // Augment with identity
  // Augmented matrix built below
  const mat = M.map((row, i) => {
    const aug = new Array(n*2).fill(0);
    for (let j=0;j<n;j++) aug[j]=row[j];
    aug[n+i]=1;
    return aug;
  });
  for (let col=0; col<n; col++) {
    // Find pivot
    let pivotRow = -1;
    for (let r=col; r<n; r++) if (Math.abs(mat[r][col])>1e-10) { pivotRow=r; break; }
    if (pivotRow===-1) return null; // singular
    [mat[col], mat[pivotRow]] = [mat[pivotRow], mat[col]];
    const pivot = mat[col][col];
    for (let j=0;j<n*2;j++) mat[col][j]/=pivot;
    for (let r=0;r<n;r++) {
      if (r===col) continue;
      const factor=mat[r][col];
      for (let j=0;j<n*2;j++) mat[r][j]-=factor*mat[col][j];
    }
  }
  return mat.map(row=>row.slice(n));
}

// Transpose a 6x6 matrix
function transposeMatrix6(M) {
  return Array.from({length:6}, (_,i) => Array.from({length:6}, (_,j) => M[j][i]));
}
