# Transformer

In the Harmonies tab, enable Edit and octave equivalence. Use the intersecting-circles
Transform button next to a harmony's visibility control.

The modal edits a draft. Save transformer updates the source harmony's name, tones
and `transformer` configuration. Save the project as usual to persist that data in
the JSON file. Reset to last saved restores the modal's latest saved draft. Closing
an unsaved draft asks before discarding it.

Select a transformation point to add its octave-normalized image to the keyboard,
or independently pin/unpin its neighborhood. Unpinning one neighborhood leaves
every other pin in place, including pins first discovered within that neighborhood.
Implicit ancestors resolve positions but are not drawn. The root neighborhood remains visible. Image harmonies inherit
source harmony options and the applicable Schritt/Wechsel marker style.

## Window and controls

Drag the top bar to move the modal. Drag its right edge, bottom edge or bottom-right
corner to resize it. The modal stays within the viewport. Both modules use the same
true split between canvas and configuration, matching the [live Keyboard](https://www.faithfulkeyboard.com).
Closing configuration gives the canvas the full width. The shared split helper
keeps toolbar and body panel widths aligned and removes stale inline resize widths.
Save/Reset sit at the left of the configuration toolbar, with Collapse at the right.
On the canvas toolbar, Transformer has its intersecting-circle brand, the source
harmony name in the center, and view-lock/theme controls. The gear returns when
configuration is hidden. Close remains at the far right of the active toolbar.
There is no inherited-style-reset pencil button.
Showing/hiding configuration crops or expands the visible world extent without
changing the diagram's screen position or pixel scale. Lock blocks pan/zoom/Fit,
and Theme uses the application's theme control.
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
- Transformations: only primary Schritts and Wechsels from the neighborhood of 1,
  including nontrivial Schritts hidden by the layout setting. Rows have Pin/Unpin
  followed by Transport/Withdraw. Each toggle retains its icon and uses a filled
  active-button style. Selecting a row shows Included Tones immediately below it.
- Pinned neighborhoods: independent pins, each with Unpin. Hover emphasizes that
  neighborhood. There are no transformation details below the list. Neighborhood
  miniatures overlap two copies of their transformation shape.
- Transported harmonies: linked keyboard harmonies, each with Withdraw. Selecting
  one shows Included Tones immediately below it; row hover emphasizes only its transformation point.

Transformer list tabs have no separate selected-name bar. Active tab text appears
next to the icon in the tab itself, and each tab is only as wide as its content.

Diagram point actions are Pin/Unpin neighborhood and Transport/Withdraw from keyboard,
with left-aligned labels and the same leading icons as their tabs. For the identity
Schritt 1, both actions are omitted. The action panel has an X
and the keyboard's shared Included Tones table. Selection remains highlighted
until dismissed. The action panel also closes on an outside click. Hovering an
included tone shows its corresponding circle with a light beige fill.
Hover previews are behind the primary graph, use the configured Schritt/Wechsel
shapes and labels, and never gray out or change the opacity of the primary graph.

Transport links are stored on the transported harmony as `transport` metadata
(source ID, operation, path and point). The same operation cannot be transported
twice from the same source. Withdrawal is immediate and does not ask for confirmation. Transporting pending
source name/tone edits asks to save those edits first, ensuring links are valid.
Source-save confirmation, source deletion and unsaved-Transformer discard use in-app
HTML dialogs, so they also work in embedded previews that block native browser
confirmation popups. Cancel always leaves the pending action unapplied.
Saving a source Transformer refreshes linked names/tones while retaining any
keyboard-specific visual edits.

Transported keyboard harmonies carry a border modifier, have read-only name/tones
and format, and omit Multiply/Invert/Reduce/Simplify. Read-only fields are disabled,
unselectable and gray-filled; transported entries retain their border modifier
without an extra arrow badge. Their Transformer action
opens the source Transformer on Transported harmonies. Cloning creates an
independent editable harmony. Deleting a source explicitly confirms withdrawal
of its linked harmonies. Full project imports preserve links; batch harmony
imports remap source IDs. A partial import without the source becomes independent,
with an explanatory alert rather than an accidental link to an unrelated source.
Source tone-format changes also update linked harmonies. Vector-defined keyboard
tones calculate their prime limit from their exponents rather than a missing ratio,
so vector transport, keyboard rendering and Included Tones work without errors.

The view never automatically fits when tones, options or expanded neighborhoods
change. Fit is an explicit action. Zoom/pan are stored as a pixel-scale camera plus
a backward-compatible SVG viewport in
the Transformer configuration; Save transformer and then save the project to
preserve them. Reset to last saved restores the saved viewport as well.
Canvas resizes update the visible extent rather than moving the camera. Tiny SVG
matrix rounding differences do not count as unsaved edits.

Schritt Geometry and Wechsel Geometry each contain Rotation, Stretch X/Y and
Offset X/Y. Each Wechsel section has a chain-button Sync toggle and a one-time
Reset button. Sync disables manual edits in that section and follows its matching
Schritt section live. Reset copies its current derived values without enabling
Sync. Colors are inverted, rotation is shifted 180 degrees and offsets are negated;
all other values are copied unchanged. Sync defaults ON for new Transformers;
existing saved choices are preserved. Tooltips are "Keep in sync with Schritt"
and "Copy from Schritt". Sync settings persist per harmony.

Show Tone Labels, Schritt Label and Wechsel Label each include Hide from pinned
(OFF by default). When enabled, the corresponding labels are omitted from nested
neighborhoods, but primary-neighborhood labels remain visible. Show letter defaults
ON and includes the `a = ` prefix in tone labels; turning it off leaves only the
tone value/name. Secondary Circle Size is available only with Flip Schritts enabled.
Tone label controls are Type, Font Size, radial Offset, Show letter, Hide from
pinned, followed by the retained Color control. Positive Offset moves labels away
from that neighborhood's own center; negative Offset moves inward, clamped at its
center. Legacy Cartesian label offsets are no longer applied.

Collapse outlines default to width 4. Wechsel-Wechsel lines use the full width,
Schritt-Schritt lines use half width, and mixed lines use half width with dashes.
Same-kind spanning sets plus a mixed bridge keep each collapse group connected
without quadratic growth. Hide from pinned defaults ON for collapses; turning it
off includes links involving nested-neighborhood points.
Collapse controls are Edge Width, Edge Color, Hide weak collapses (OFF by default),
and Hide from pinned. Hide weak collapses removes only dashed mixed
Schritt-Wechsel links; the two solid link types remain.

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
Older project files without the field use harmony-derived defaults. Reset returns
to the last saved Transformer configuration. The former inherited-style reset
button is no longer shown.

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
node tests/transformer-pins.test.cjs http://127.0.0.1:8766
node tests/transformer-split-controls.test.cjs http://127.0.0.1:8766
```

## Shared configuration components

`js/ui-components.js` provides sections, independent checkbox disclosures, tabs,
selection bars/pickers, choice menus, list rows and split-panel layout helpers.
Transformer's lists intentionally omit the Keyboard's selected-name bar. The Keyboard
Key Shape section contains only Shape through Opacity; style, rotation, stretch,
offset, connections and labels are peer sections. Key Style, Key Rotation, Key
Stretch, Connect Tones and Show Secondary Labels start collapsed. Editing
non-default suboptions enables their main checkbox. Layout hide switches live
in a separate Hide section. Explicit disclosure choices are retained during the
session when switching harmonies, preserving the bulk-parameter editing workflow.
Legacy `expanded` paths and `hideDerived` JSON keys
are retained for compatibility, while the visible terminology is Pinned.
