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

## Window and controls

Drag the top bar to move the modal. Drag its right edge, bottom edge or bottom-right
corner to resize it. The modal stays within the viewport. Narrow windows show the
configuration panel over the diagram rather than squeezing the diagram.
The circular Show/Hide configuration controls share one top-right position and use
the same icons as the keyboard. The configuration panel overlays the diagram;
showing or hiding it never changes the diagram's screen position or scale.
Numeric controls pair keyboard-style sliders with fine-value inputs. Section
headings remain collapsible, independently of their enable checkboxes. The same
disclosure design is used by the keyboard's harmony, layout and sound sections.
Save transformer also saves the modal rectangle. Reopening restores its size and
position, clamped within the current screen.

## Configuration tabs and actions

- Harmony: source name, tones, format and tone operations.
- Layout: Show Nontrivial Schritts, Show Collapses, Show Tone Labels, Circle Style,
  then Hovers. Hover neighborhoods and tone circles both default ON.
- Design: Schritt/Wechsel label, shape, style and geometry controls.
- Transformations: all Schritts and Wechsels from the current neighborhoods,
  including nontrivial Schritts hidden by the layout setting. Rows have transport/
  withdraw and show/hide-derived-neighborhood actions. Selecting a row expands
  the shared keyboard Included Tones table directly below it.
- Derived neighborhoods: the added neighborhoods, each with Delete. Hover
  emphasizes that neighborhood; removing a parent also removes its descendants.
- Transported harmonies: linked keyboard harmonies, each with Withdraw. Selecting
  one shows Included Tones; row hover emphasizes only its transformation point.

Diagram point actions are Transport to keyboard / Withdraw from keyboard and
Show derived neighborhood / Hide derived neighborhood. The action panel has an X
and the keyboard's shared Included Tones table. Selection remains highlighted
until dismissed. Hovering an included tone shows its corresponding circle.
Hover previews are behind the primary graph, use the configured Schritt/Wechsel
shapes and labels, and never gray out or change the opacity of the primary graph.

Transport links are stored on the transported harmony as `transport` metadata
(source ID, operation, path and point). The same operation cannot be transported
twice from the same source. Withdrawal asks for confirmation. Transporting pending
source name/tone edits asks to save those edits first, ensuring links are valid.
Saving a source Transformer refreshes linked names/tones while retaining any
keyboard-specific visual edits.

Transported keyboard harmonies carry a visual badge, have read-only name/tones
and format, and omit Multiply/Invert/Reduce/Simplify. Their Transformer action
opens the source Transformer on Transported harmonies. Cloning creates an
independent editable harmony. Deleting a source explicitly confirms withdrawal
of its linked harmonies. Full project imports preserve links; batch harmony
imports remap source IDs. A partial import without the source becomes independent,
with an explanatory alert rather than an accidental link to an unrelated source.
Source tone-format changes also update linked harmonies. Vector-defined keyboard
tones calculate their prime limit from their exponents rather than a missing ratio,
so vector transport, keyboard rendering and Included Tones work without errors.

The view never automatically fits when tones, options or expanded neighborhoods
change. Fit is an explicit action. Zoom and pan are stored as the SVG viewport in
the Transformer configuration; Save transformer and then save the project to
preserve them. Reset to last saved restores the saved viewport as well.

Schritt Geometry and Wechsel Geometry each contain Rotation, Stretch X/Y and
Offset X/Y. Each Wechsel section has a chain-button Sync toggle and a one-time
Reset button. Sync disables manual edits in that section and follows its matching
Schritt section live. Reset copies its current derived values without enabling
Sync. Colors are inverted, rotation is shifted 180 degrees and offsets are negated;
all other values are copied unchanged. Sync defaults ON for new Transformers;
existing saved choices are preserved. Tooltips are "Keep in sync with Schritt"
and "Copy from Schritt". Sync settings persist per harmony.

Show Tone Labels, Schritt Label and Wechsel Label each include Hide from derived
(OFF by default). When enabled, the corresponding labels are omitted from nested
neighborhoods, but primary-neighborhood labels remain visible. Show letter defaults
ON and includes the `a = ` prefix in tone labels; turning it off leaves only the
tone value/name. Secondary Circle Size is available only with Flip Schritts enabled.

Collapse outlines default to width 4. Wechsel-Wechsel lines use the full width,
Schritt-Schritt lines use half width, and mixed lines use half width with dashes.
Same-kind spanning sets plus a mixed bridge keep each collapse group connected
without quadratic growth. Hide from derived defaults ON for collapses; turning it
off includes links involving nested-neighborhood points.

Circle outlines default to width 6. Each nested neighborhood uses 60% of its
parent's outline width, 78% of its opacity and 85% of its point size. Label font
sizes stay unchanged. Hover or focus a point to emphasize its neighborhood;
unexpanded neighborhoods appear as temporary, noninteractive previews which
are not saved. Hover or focus a tone label to highlight its circle and the
transformation points belonging to that circle. Circle outlines also support hover.
Highlight/preview geometry is behind the main diagram. Hover enters over 350 ms,
then waits 180 ms after leaving before fading out over 350 ms. Reduced-motion
preferences disable the fades.

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
Schritt/Wechsel graphics, collapse options, panel visibility, expanded paths and
the zoom/pan viewport, active tab, hover options and modal rectangle.
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
node tests/transformer-refinements.test.cjs http://127.0.0.1:8766
node tests/transformer-view-labels.test.cjs http://127.0.0.1:8766
node tests/transformer-workspace.test.cjs http://127.0.0.1:8766
node tests/transformer-links.test.cjs http://127.0.0.1:8766
```
