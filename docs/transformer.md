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
harmony name in the center, and an icon-only Fit action. Its brand icon is 24px,
matching the Keyboard logo. The gear returns when
configuration is hidden. Close remains at the far right of the active toolbar.
There is no inherited-style-reset pencil button.
Showing/hiding configuration crops or expands the visible world extent without
changing the diagram's screen position or pixel scale. Transformer has no Lock
or Theme buttons; obsolete saved lock flags no longer disable navigation.
The bottom count/status bar and navigation instructions are removed. Validation
errors and save feedback use a separate accessible floating message.
Numeric controls pair keyboard-style sliders with fine-value inputs. Section
headings remain collapsible, independently of their enable checkboxes. The same
disclosure design is used by the keyboard's harmony, layout and sound sections.
Save transformer also saves the modal rectangle. Reopening restores its size and
position, clamped within the current screen.

## Configuration tabs and actions

- Harmony: source name, tones, format, tone operations and Lettering.
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
  one shows Included Tones immediately below it; row hover emphasizes its neighborhood.

Transformer list tabs have no separate selected-name bar. Active tab text appears
next to the icon in the tab itself, and each tab is only as wide as its content.
All three lists deselect an item when it is clicked again. Transformations and
Transported harmonies both preview the respective neighborhood on hover.

Diagram point actions are Pin/Unpin neighborhood and Transport/Withdraw from keyboard,
with left-aligned labels and the same leading icons as their tabs. For the identity
Schritt 1, both actions are omitted. The action panel has X and Pin panel buttons
and the shared Included Tones table. Outside clicks dismiss an unpinned panel,
clear its selection and remove highlight layers. Clicking/opening a panel does
not latch a neighborhood highlight; hover highlights fade normally.
Multiple comparison panels can be pinned independently, dragged by their title,
and individually unpinned or closed. They survive outside clicks and style redraws,
but are temporary workspace state, not project settings. Editing source tones or
resetting the draft clears these temporary panels. On very narrow canvases while
configuration is open, comparison panels are temporarily concealed rather than
clipped; collapsing configuration reveals them again without losing their state.
Hovering an
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
Transformer Included Tones tables use Letter, Tone, Name, cents and Hz, with no W.
The key miniature is retained inside the Tone cell, so Letter is truly the first column,
including action panels, pinned comparison panels and both list-detail tables.
The Keyboard's Included Tones table is unchanged.
Letters follow their original tones through the transformation rather than being
reassigned after sorting its image. For source `1 -> a, 3/2 -> b, 5/4 -> c`,
Wechsel `ab` produces `3/2 -> a, 1 -> b, 6/5 -> c`. This correspondence is the
same in comparison panels, pinned-neighborhood tone labels and transported tables.
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
Sync. Chromatic colors use the complementary hue at the same lightness/saturation,
so pale purple `#c5bff8` becomes pale yellow-green `#f2f8bf`, rather than nearly
black. Neutral colors use the ordinary RGB negative (white/black swap).
Marker labels get a contrasting outline when label/fill contrast is below 4.5:1,
without changing the configured label color; this also applies to hover previews.
Rotation is shifted 180 degrees and offsets are negated;
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

Harmony > Lettering lists original Tone, Tone Name and editable Letter. Default
letters start at a in ascending original pitch order, before octave reduction:
`1,3,5` maps to `a,b,c` even though reduced pitches sort as `1,5/4,3/2`.
Letters must be unique single Unicode letters. Edits persist as a per-harmony
`letters` map keyed by normalized pitch, and update tone labels, monomials,
transported names and Included Tones without changing operation vectors or
neighborhood path IDs. Factors in displayed monomials are sorted by their current
letters. The original geometric/index ordering is preserved.

Schritt `q` maps a tone `x` to `qx`; Wechsel `q` maps `x` to `q/x`.
Formal monomials are integer exponent vectors over the original tone letters.
For local transformation `u` in parent neighborhood `m`, the composed exponent
vector is `m.q + sign(m)*u.q`; inversion parity is XOR. This implements
`s1#s2=s1*s2`, `w1#s2=w1*s2`, `s1#w2=w2/s1`, and `w1#w2=w2/w1`.
For example, `a/b` in the neighborhood of Wechsel `bc` is Wechsel `b²c/a`.

Neighborhood geometry uses a fixed vector for each original tone letter,
with the configured circle rotation applied once. A Schritt parent retains
these directions; a Wechsel parent reverses them. Transformed frequency values
label the circles but must not rotate the coordinate frame again.
In the ordinary (unflipped) layout, a transformation has position
`P(q) = sum(q_i * p_i)` relative to the primary origin, independent of the path
used to reach it. In particular, the identity reached inside Wechsel `ab`
coincides with the primary identity. Hover previews, pins and transported-item
lookup all use this same geometry function.
Primary markers and tone-label hit targets stay above nested aliases.
Coincident tone labels use the plot background as a backing so the primary
label remains legible rather than printing two letter prefixes over each other.
Flip Schritts is the prototype's separate visual relocation onto complementary
circles; that relocation is not the additive coordinate embedding and does not
guarantee cross-neighborhood overlap for the relocated Schritt markers.

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
node tests/transformer-neighborhood-frame.test.cjs http://127.0.0.1:8766
node tests/transformer-lettering-panels.test.cjs http://127.0.0.1:8766
node tests/transformer-wechsel-lettering.test.cjs http://127.0.0.1:8766
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
