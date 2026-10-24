# Transformer

In the Harmonies tab, enable Edit and octave equivalence. Use the intersecting-circles
Transform button next to a harmony's visibility control.

The modal edits a draft. Save transformer updates the source harmony's name, tones
and `transformer` configuration. Save the project as usual to persist that data in
the JSON file. Reset to last saved restores the modal's latest saved draft. Closing
an unsaved draft asks before discarding it.

Select a transformation point to add its octave-normalized image to the keyboard,
or independently expand/hide its neighborhood. Hiding a neighborhood removes its
descendants too. The root neighborhood remains visible. Image harmonies inherit
source harmony options and the applicable Schritt/Wechsel marker style.

## Algebra and coordinates

Schritt `q` maps a tone `x` to `qx`; Wechsel `q` maps `x` to `q/x`.
Formal monomials are integer exponent vectors over the original tone letters.
For local transformation `u` in parent neighborhood `m`, the composed exponent
vector is `m.q + sign(m)*u.q`; inversion parity is XOR. This implements
`s1#s2=s1*s2`, `w1#s2=w1*s2`, `s1#w2=w2/s1`, and `w1#w2=w2/w1`.
For example, `a/b` in the neighborhood of Wechsel `bc` is Wechsel `b²c/a`.

Rational images use BigInt arithmetic and exact octave reduction. Fractional
prime-exponent vectors use logarithmic octave normalization. Collapse groups
compare complete image tone sets, not just scalar transformation coefficients.
The prototype's primary circles, common origin, other intersections, flipped
Schritts and complementary circles are preserved.

Size values retain the source harmony's settings. Since keyboard key size is in
cents-like layout units, marker geometry uses one quarter of that value in diagram
units; label sizes use a factor of two. Zoom applies to the whole SVG diagram.

## Persistence and limits

The additive `harmony.transformer` field contains circle options, tone labels,
Schritt/Wechsel graphics, collapse options, panel visibility and expanded paths.
Older project files without the field use harmony-derived defaults. Reset style
resets inherited marker and label settings, without changing circle settings or
neighborhood visibility.

There may be up to 16 distinct octave-equivalent tones, 24 expanded neighborhoods,
and 8 expansion levels. These bounds keep the SVG and exact arithmetic responsive.
Invalid input produces a modal error and does not overwrite the source harmony.

## Tests

Run pure algebra/geometry tests with:

```sh
node tests/transformer-math.test.cjs
```

With a static server running and Playwright available:

```sh
node tests/transformer-ui.test.cjs http://127.0.0.1:8766
```
