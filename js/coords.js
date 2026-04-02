// coords.js
// COORD_SYSTEMS table, basis inversion, width computation.
// ======================================================================


// ═════════════════════════════════════════════════════════════════════════════
//  COORDINATE SYSTEMS
// ═════════════════════════════════════════════════════════════════════════════

const COORD_SYSTEMS = {
  primes: {
    name: 'Primes',
    labels: ['2', '3', '5', '7', '11', '13'],
    // basis rows in prime-exponent space — identity
    basis: [
      [1,0,0,0,0,0],
      [0,1,0,0,0,0],
      [0,0,1,0,0,0],
      [0,0,0,1,0,0],
      [0,0,0,0,1,0],
      [0,0,0,0,0,1]
    ],
    defaults: [0, 2.0, 4.5, 4.0, 3.5, 1.6]
  },
  reduced: {
    name: 'Reduced Primes',
    labels: ['2 (oct)', '3/2 (fifth)', '5/4 (M3)', '7/4 (nat7)', '11/8 (nat11)', '13/8 (nat13)'],
    basis: [
      [1, 0, 0, 0, 0, 0],   // 2
      [-1, 1, 0, 0, 0, 0],  // 3/2
      [-2, 0, 1, 0, 0, 0],  // 5/4
      [-2, 0, 0, 1, 0, 0],  // 7/4
      [-3, 0, 0, 0, 1, 0],  // 11/8
      [-3, 0, 0, 0, 0, 1]   // 13/8
    ],
    defaults: [0, 2.0, 4.5, 4.0, 3.5, 1.6]
  },
  pythagorean: {
    name: 'Pythagorean + Commas',
    labels: ['2 (oct)', '3/2 (fifth)', '81/80 (syntonic)', '64/63 (septimal)', '33/32 (undecimal)', '27/26 (tridecimal)'],
    basis: [
      [1, 0, 0, 0, 0, 0],   // 2
      [-1, 1, 0, 0, 0, 0],  // 3/2
      [4, -4, 1, 0, 0, 0],  // 81/80
      [6, -2, 0, -1, 0, 0], // 64/63
      [-5, 1, 0, 0, 1, 0],  // 33/32
      [-1, 3, 0, 0, 0, -1]  // 27/26
    ],
    defaults: [0, 0.9, 1.0, 1.25, 3.0, 1.6]
  },
  other: {
    name: 'Other (custom)',
    labels: ['b1','b2','b3','b4','b5','b6'],
    basis: [
      [1, 0, 0, 0, 0, 0],
      [-1, 1, 0, 0, 0, 0],
      [-2, 0, 1, 0, 0, 0],
      [-2, 0, 0, 1, 0, 0],
      [-3, 0, 0, 0, 1, 0],
      [-3, 0, 0, 0, 0, 1]
    ],
    defaults: [0, 2.0, 4.5, 4.0, 3.5, 1.6]
  }
};

// Compute width for a tone given basis and width assignments.
// The width is w · c, where c are the coordinates of exps in the given basis.
// Since basis rows span the space, we solve B * c = e (treating basis as row matrix)
// i.e. c = B^{-1} * e. Then width = w^T * c = w^T * B^{-1} * e.
// We precompute B^{-1} when the basis changes to avoid re-inverting per key.
let _cachedBasis = null;
let _cachedBasisInvT = null;

function getBasisInvT(basis) {
  // Cache (B^T)^{-1} = (B^{-1})^T — used to find coordinates in basis
  // Decomposition: e = sum_i c_i * row_i  =>  B^T * c = e  =>  c = (B^T)^{-1} * e
  if (basis === _cachedBasis) return _cachedBasisInvT;
  _cachedBasis = basis;
  _cachedBasisInvT = invertMatrix6(transposeMatrix6(basis));
  return _cachedBasisInvT;
}

function computeWidth(exps, basis, widthAssignments) {
  const invT = getBasisInvT(basis);
  if (!invT) {
    // Singular basis — fall back to dot product with basis rows
    return basis.reduce((sum, basisRow, i) => sum + (widthAssignments[i]||0) * dot(exps, basisRow), 0);
  }
  // c = (B^T)^{-1} * exps  (coordinates of exps in the basis)
  const coords = invT.map(row => dot(row, exps));
  return coords.reduce((sum, c, i) => sum + (widthAssignments[i]||0) * c, 0);
}
