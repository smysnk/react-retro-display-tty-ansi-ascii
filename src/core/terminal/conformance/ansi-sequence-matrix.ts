import type { RetroLcdTerminalCommand } from "../commands";
import { ansi16ColorsFixture } from "./fixtures/ansi-16-colors.fixture";
import {
  ansiCommandMatrixFixtures,
  ansiSaveRestoreFixture,
  carriageReturnFixture,
  cursorDownFixture,
  cursorForwardFixture,
  cursorPositionFixture,
  cursorUpFixture,
  eraseInDisplayFixture,
  eraseInLineFixture,
  lineFeedFixture,
  resetToInitialStateFixture,
  sgrAttributesFixture,
  tabExpansionFixture
} from "./fixtures/ansi-command-matrix.fixtures";
import { backspaceWithoutOverwriteFixture } from "./fixtures/backspace-without-overwrite.fixture";
import { decSaveRestoreFixture } from "./fixtures/dec-save-restore.fixture";
import { decWraparoundToggleFixture } from "./fixtures/dec-wraparound-toggle.fixture";
import { deleteCharsFixture } from "./fixtures/delete-chars.fixture";
import { deleteLinesFixture } from "./fixtures/delete-lines.fixture";
import { escIndexFixture } from "./fixtures/esc-index.fixture";
import { escNextLineFixture } from "./fixtures/esc-next-line.fixture";
import { escReverseIndexFixture } from "./fixtures/esc-reverse-index.fixture";
import { indexed256ColorsFixture } from "./fixtures/indexed-256-colors.fixture";
import { insertCharsFixture } from "./fixtures/insert-chars.fixture";
import { insertLinesFixture } from "./fixtures/insert-lines.fixture";
import { insertModePrintFixture } from "./fixtures/insert-mode-print.fixture";
import { originModeHomeFixture } from "./fixtures/origin-mode-home.fixture";
import { partialCsiCursorBackwardFixture } from "./fixtures/partial-csi-cursor-backward.fixture";
import { scrollRegionShiftFixture } from "./fixtures/scroll-region-shift.fixture";
import { truecolorFixture } from "./fixtures/truecolor.fixture";
import type {
  RetroLcdConformanceClassification,
  RetroLcdTerminalFixture
} from "./types";

export type RetroLcdAnsiSequenceFamily =
  | "c0"
  | "escape"
  | "csi"
  | "csi-private"
  | "sgr";

export type RetroLcdAnsiCoverageLevel =
  | "parser-only"
  | "oracle-backed"
  | "host-facing";

export type RetroLcdAnsiSequenceCase = {
  id: string;
  family: RetroLcdAnsiSequenceFamily;
  description: string;
  sequence: string;
  expectedCommands: RetroLcdTerminalCommand[];
  coverage: RetroLcdAnsiCoverageLevel;
  fixture?: RetroLcdTerminalFixture;
};

export type RetroLcdAnsiSupportGap = {
  id: string;
  family: RetroLcdAnsiSequenceFamily | "extended";
  classification: RetroLcdConformanceClassification;
  description: string;
  examples: string[];
};

const modeIdentifier = (prefix: string | undefined, final: "h" | "l") => ({
  prefix,
  final,
  intermediates: undefined
});

export const ansiSupportedSequenceCases = [
  {
    id: "c0-line-feed",
    family: "c0",
    description: "LF should dispatch a line-feed command.",
    sequence: "\n",
    expectedCommands: [{ type: "lineFeed" }],
    coverage: "oracle-backed",
    fixture: lineFeedFixture
  },
  {
    id: "c0-carriage-return",
    family: "c0",
    description: "CR should dispatch a carriage-return command.",
    sequence: "\r",
    expectedCommands: [{ type: "carriageReturn" }],
    coverage: "oracle-backed",
    fixture: carriageReturnFixture
  },
  {
    id: "c0-backspace",
    family: "c0",
    description: "BS should dispatch a non-destructive backspace command.",
    sequence: "\b",
    expectedCommands: [{ type: "backspace" }],
    coverage: "oracle-backed",
    fixture: backspaceWithoutOverwriteFixture
  },
  {
    id: "c0-tab",
    family: "c0",
    description: "HT should dispatch a tab command.",
    sequence: "\t",
    expectedCommands: [{ type: "tab" }],
    coverage: "oracle-backed",
    fixture: tabExpansionFixture
  },
  {
    id: "c0-form-feed",
    family: "c0",
    description: "FF should dispatch a form-feed command.",
    sequence: "\f",
    expectedCommands: [{ type: "formFeed" }],
    coverage: "parser-only"
  },
  {
    id: "c0-bell",
    family: "c0",
    description: "BEL should dispatch a bell command.",
    sequence: "\u0007",
    expectedCommands: [{ type: "bell" }],
    coverage: "host-facing"
  },
  {
    id: "csi-insert-chars",
    family: "csi",
    description: "CSI @ should insert blank cells.",
    sequence: "\u001b[2@",
    expectedCommands: [{ type: "insertChars", count: 2 }],
    coverage: "oracle-backed",
    fixture: insertCharsFixture
  },
  {
    id: "csi-cursor-up",
    family: "csi",
    description: "CSI A should move the cursor upward.",
    sequence: "\u001b[3A",
    expectedCommands: [{ type: "cursorUp", count: 3 }],
    coverage: "oracle-backed",
    fixture: cursorUpFixture
  },
  {
    id: "csi-cursor-down",
    family: "csi",
    description: "CSI B should move the cursor downward.",
    sequence: "\u001b[4B",
    expectedCommands: [{ type: "cursorDown", count: 4 }],
    coverage: "oracle-backed",
    fixture: cursorDownFixture
  },
  {
    id: "csi-cursor-forward",
    family: "csi",
    description: "CSI C should move the cursor forward.",
    sequence: "\u001b[5C",
    expectedCommands: [{ type: "cursorForward", count: 5 }],
    coverage: "oracle-backed",
    fixture: cursorForwardFixture
  },
  {
    id: "csi-cursor-backward",
    family: "csi",
    description: "CSI D should move the cursor backward.",
    sequence: "\u001b[6D",
    expectedCommands: [{ type: "cursorBackward", count: 6 }],
    coverage: "oracle-backed",
    fixture: partialCsiCursorBackwardFixture
  },
  {
    id: "csi-cursor-position-h",
    family: "csi",
    description: "CSI H should position the cursor.",
    sequence: "\u001b[7;8H",
    expectedCommands: [{ type: "cursorPosition", row: 7, col: 8 }],
    coverage: "oracle-backed",
    fixture: cursorPositionFixture
  },
  {
    id: "csi-cursor-position-f",
    family: "csi",
    description: "CSI f should alias cursor positioning.",
    sequence: "\u001b[2;3f",
    expectedCommands: [{ type: "cursorPosition", row: 2, col: 3 }],
    coverage: "oracle-backed",
    fixture: cursorPositionFixture
  },
  {
    id: "csi-insert-lines",
    family: "csi",
    description: "CSI L should insert lines within the scroll region.",
    sequence: "\u001b[2L",
    expectedCommands: [{ type: "insertLines", count: 2 }],
    coverage: "oracle-backed",
    fixture: insertLinesFixture
  },
  {
    id: "csi-delete-lines",
    family: "csi",
    description: "CSI M should delete lines within the scroll region.",
    sequence: "\u001b[2M",
    expectedCommands: [{ type: "deleteLines", count: 2 }],
    coverage: "oracle-backed",
    fixture: deleteLinesFixture
  },
  {
    id: "csi-delete-chars",
    family: "csi",
    description: "CSI P should delete characters from the cursor onward.",
    sequence: "\u001b[2P",
    expectedCommands: [{ type: "deleteChars", count: 2 }],
    coverage: "oracle-backed",
    fixture: deleteCharsFixture
  },
  {
    id: "csi-scroll-up",
    family: "csi",
    description: "CSI S should scroll the active region upward.",
    sequence: "\u001b[2S",
    expectedCommands: [{ type: "scrollUp", count: 2 }],
    coverage: "oracle-backed",
    fixture: scrollRegionShiftFixture
  },
  {
    id: "csi-scroll-down",
    family: "csi",
    description: "CSI T should scroll the active region downward.",
    sequence: "\u001b[2T",
    expectedCommands: [{ type: "scrollDown", count: 2 }],
    coverage: "oracle-backed",
    fixture: scrollRegionShiftFixture
  },
  {
    id: "csi-scroll-region",
    family: "csi",
    description: "CSI r should set the active scroll region.",
    sequence: "\u001b[2;4r",
    expectedCommands: [{ type: "setScrollRegion", top: 2, bottom: 4 }],
    coverage: "oracle-backed",
    fixture: scrollRegionShiftFixture
  },
  {
    id: "csi-erase-display-default",
    family: "csi",
    description: "CSI J should default to erase-in-display mode 0.",
    sequence: "\u001b[J",
    expectedCommands: [{ type: "eraseInDisplay", mode: 0 }],
    coverage: "oracle-backed",
    fixture: eraseInDisplayFixture
  },
  {
    id: "csi-erase-display-all",
    family: "csi",
    description: "CSI 2J should erase the whole display.",
    sequence: "\u001b[2J",
    expectedCommands: [{ type: "eraseInDisplay", mode: 2 }],
    coverage: "oracle-backed",
    fixture: eraseInDisplayFixture
  },
  {
    id: "csi-erase-display-scrollback",
    family: "csi",
    description: "CSI 3J should request clearing the display and scrollback.",
    sequence: "\u001b[3J",
    expectedCommands: [{ type: "eraseInDisplay", mode: 3 }],
    coverage: "parser-only"
  },
  {
    id: "csi-erase-line-default",
    family: "csi",
    description: "CSI K should default to erase-in-line mode 0.",
    sequence: "\u001b[K",
    expectedCommands: [{ type: "eraseInLine", mode: 0 }],
    coverage: "oracle-backed",
    fixture: eraseInLineFixture
  },
  {
    id: "csi-erase-line-start",
    family: "csi",
    description: "CSI 1K should erase from the start of the line through the cursor.",
    sequence: "\u001b[1K",
    expectedCommands: [{ type: "eraseInLine", mode: 1 }],
    coverage: "parser-only"
  },
  {
    id: "csi-erase-line-all",
    family: "csi",
    description: "CSI 2K should erase the active line.",
    sequence: "\u001b[2K",
    expectedCommands: [{ type: "eraseInLine", mode: 2 }],
    coverage: "parser-only"
  },
  {
    id: "csi-save-cursor",
    family: "csi",
    description: "CSI s should save the cursor position.",
    sequence: "\u001b[s",
    expectedCommands: [{ type: "saveCursor", source: "ansi" }],
    coverage: "oracle-backed",
    fixture: ansiSaveRestoreFixture
  },
  {
    id: "csi-restore-cursor",
    family: "csi",
    description: "CSI u should restore the cursor position.",
    sequence: "\u001b[u",
    expectedCommands: [{ type: "restoreCursor", source: "ansi" }],
    coverage: "oracle-backed",
    fixture: ansiSaveRestoreFixture
  },
  {
    id: "sgr-reset-default",
    family: "sgr",
    description: "CSI m with no params should reset SGR state.",
    sequence: "\u001b[m",
    expectedCommands: [{ type: "setGraphicRendition", params: [] }],
    coverage: "parser-only"
  },
  {
    id: "sgr-attributes",
    family: "sgr",
    description: "CSI m should carry emphasis attributes like bold, faint, inverse, conceal, and blink.",
    sequence: "\u001b[1;2;5;7;8m",
    expectedCommands: [{ type: "setGraphicRendition", params: [1, 2, 5, 7, 8] }],
    coverage: "oracle-backed",
    fixture: sgrAttributesFixture
  },
  {
    id: "sgr-ansi-16-colors",
    family: "sgr",
    description: "CSI m should preserve ANSI 16-color palette indices.",
    sequence: "\u001b[31;44;91;102m",
    expectedCommands: [{ type: "setGraphicRendition", params: [31, 44, 91, 102] }],
    coverage: "oracle-backed",
    fixture: ansi16ColorsFixture
  },
  {
    id: "sgr-indexed-256-colors",
    family: "sgr",
    description: "CSI 38;5 / 48;5 m should preserve indexed 256-color palette values.",
    sequence: "\u001b[38;5;196;48;5;25m",
    expectedCommands: [{ type: "setGraphicRendition", params: [38, 5, 196, 48, 5, 25] }],
    coverage: "oracle-backed",
    fixture: indexed256ColorsFixture
  },
  {
    id: "sgr-truecolor",
    family: "sgr",
    description: "CSI 38;2 / 48;2 m should preserve RGB truecolor values.",
    sequence: "\u001b[38;2;17;34;51;48;2;68;85;102m",
    expectedCommands: [
      { type: "setGraphicRendition", params: [38, 2, 17, 34, 51, 48, 2, 68, 85, 102] }
    ],
    coverage: "oracle-backed",
    fixture: truecolorFixture
  },
  {
    id: "csi-set-insert-mode",
    family: "csi",
    description: "CSI 4h should enable ANSI insert mode.",
    sequence: "\u001b[4h",
    expectedCommands: [{ type: "setMode", identifier: modeIdentifier(undefined, "h"), params: [4] }],
    coverage: "oracle-backed",
    fixture: insertModePrintFixture
  },
  {
    id: "csi-reset-insert-mode",
    family: "csi",
    description: "CSI 4l should disable ANSI insert mode.",
    sequence: "\u001b[4l",
    expectedCommands: [
      { type: "resetMode", identifier: modeIdentifier(undefined, "l"), params: [4] }
    ],
    coverage: "parser-only"
  },
  {
    id: "csi-decset-application-cursor-keys",
    family: "csi-private",
    description: "CSI ?1h should enable application cursor keys mode.",
    sequence: "\u001b[?1h",
    expectedCommands: [{ type: "setMode", identifier: modeIdentifier("?", "h"), params: [1] }],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-origin-mode",
    family: "csi-private",
    description: "CSI ?6h should enable origin mode.",
    sequence: "\u001b[?6h",
    expectedCommands: [{ type: "setMode", identifier: modeIdentifier("?", "h"), params: [6] }],
    coverage: "oracle-backed",
    fixture: originModeHomeFixture
  },
  {
    id: "csi-decrst-origin-mode",
    family: "csi-private",
    description: "CSI ?6l should disable origin mode.",
    sequence: "\u001b[?6l",
    expectedCommands: [{ type: "resetMode", identifier: modeIdentifier("?", "l"), params: [6] }],
    coverage: "parser-only"
  },
  {
    id: "csi-decset-wraparound-mode",
    family: "csi-private",
    description: "CSI ?7h should enable wraparound mode.",
    sequence: "\u001b[?7h",
    expectedCommands: [{ type: "setMode", identifier: modeIdentifier("?", "h"), params: [7] }],
    coverage: "oracle-backed",
    fixture: decWraparoundToggleFixture
  },
  {
    id: "csi-decrst-wraparound-mode",
    family: "csi-private",
    description: "CSI ?7l should disable wraparound mode.",
    sequence: "\u001b[?7l",
    expectedCommands: [{ type: "resetMode", identifier: modeIdentifier("?", "l"), params: [7] }],
    coverage: "oracle-backed",
    fixture: decWraparoundToggleFixture
  },
  {
    id: "csi-decset-cursor-visibility",
    family: "csi-private",
    description: "CSI ?25h should show the cursor.",
    sequence: "\u001b[?25h",
    expectedCommands: [{ type: "setMode", identifier: modeIdentifier("?", "h"), params: [25] }],
    coverage: "host-facing"
  },
  {
    id: "csi-decrst-cursor-visibility",
    family: "csi-private",
    description: "CSI ?25l should hide the cursor.",
    sequence: "\u001b[?25l",
    expectedCommands: [{ type: "resetMode", identifier: modeIdentifier("?", "l"), params: [25] }],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-alternate-screen-47",
    family: "csi-private",
    description: "CSI ?47h should request the alternate screen buffer.",
    sequence: "\u001b[?47h",
    expectedCommands: [{ type: "setMode", identifier: modeIdentifier("?", "h"), params: [47] }],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-alternate-screen-1047",
    family: "csi-private",
    description: "CSI ?1047h should request the alternate screen buffer.",
    sequence: "\u001b[?1047h",
    expectedCommands: [{ type: "setMode", identifier: modeIdentifier("?", "h"), params: [1047] }],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-alternate-screen-1049",
    family: "csi-private",
    description: "CSI ?1049h should request the alternate screen buffer with save/restore semantics.",
    sequence: "\u001b[?1049h",
    expectedCommands: [{ type: "setMode", identifier: modeIdentifier("?", "h"), params: [1049] }],
    coverage: "host-facing"
  },
  {
    id: "csi-decrst-alternate-screen-1049",
    family: "csi-private",
    description: "CSI ?1049l should leave the alternate screen buffer.",
    sequence: "\u001b[?1049l",
    expectedCommands: [
      { type: "resetMode", identifier: modeIdentifier("?", "l"), params: [1049] }
    ],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-vt200-mouse",
    family: "csi-private",
    description: "CSI ?1000h should enable VT200 mouse tracking.",
    sequence: "\u001b[?1000h",
    expectedCommands: [
      { type: "setMode", identifier: modeIdentifier("?", "h"), params: [1000] }
    ],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-drag-mouse",
    family: "csi-private",
    description: "CSI ?1002h should enable drag mouse tracking.",
    sequence: "\u001b[?1002h",
    expectedCommands: [
      { type: "setMode", identifier: modeIdentifier("?", "h"), params: [1002] }
    ],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-any-mouse",
    family: "csi-private",
    description: "CSI ?1003h should enable any-motion mouse tracking.",
    sequence: "\u001b[?1003h",
    expectedCommands: [
      { type: "setMode", identifier: modeIdentifier("?", "h"), params: [1003] }
    ],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-focus-reporting",
    family: "csi-private",
    description: "CSI ?1004h should enable focus reporting.",
    sequence: "\u001b[?1004h",
    expectedCommands: [
      { type: "setMode", identifier: modeIdentifier("?", "h"), params: [1004] }
    ],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-sgr-mouse",
    family: "csi-private",
    description: "CSI ?1006h should enable SGR mouse protocol.",
    sequence: "\u001b[?1006h",
    expectedCommands: [
      { type: "setMode", identifier: modeIdentifier("?", "h"), params: [1006] }
    ],
    coverage: "host-facing"
  },
  {
    id: "csi-decset-bracketed-paste",
    family: "csi-private",
    description: "CSI ?2004h should enable bracketed paste.",
    sequence: "\u001b[?2004h",
    expectedCommands: [
      { type: "setMode", identifier: modeIdentifier("?", "h"), params: [2004] }
    ],
    coverage: "host-facing"
  },
  {
    id: "esc-dec-save-cursor",
    family: "escape",
    description: "ESC 7 should save the cursor position.",
    sequence: "\u001b7",
    expectedCommands: [{ type: "saveCursor", source: "dec" }],
    coverage: "oracle-backed",
    fixture: decSaveRestoreFixture
  },
  {
    id: "esc-dec-restore-cursor",
    family: "escape",
    description: "ESC 8 should restore the cursor position.",
    sequence: "\u001b8",
    expectedCommands: [{ type: "restoreCursor", source: "dec" }],
    coverage: "oracle-backed",
    fixture: decSaveRestoreFixture
  },
  {
    id: "esc-index",
    family: "escape",
    description: "ESC D should perform IND / index.",
    sequence: "\u001bD",
    expectedCommands: [{ type: "index" }],
    coverage: "oracle-backed",
    fixture: escIndexFixture
  },
  {
    id: "esc-next-line",
    family: "escape",
    description: "ESC E should perform NEL / next line.",
    sequence: "\u001bE",
    expectedCommands: [{ type: "nextLine" }],
    coverage: "oracle-backed",
    fixture: escNextLineFixture
  },
  {
    id: "esc-reverse-index",
    family: "escape",
    description: "ESC M should perform RI / reverse index.",
    sequence: "\u001bM",
    expectedCommands: [{ type: "reverseIndex" }],
    coverage: "oracle-backed",
    fixture: escReverseIndexFixture
  },
  {
    id: "esc-reset-to-initial-state",
    family: "escape",
    description: "ESC c should reset the terminal to its initial state.",
    sequence: "\u001bc",
    expectedCommands: [{ type: "resetToInitialState" }],
    coverage: "oracle-backed",
    fixture: resetToInitialStateFixture
  }
] satisfies RetroLcdAnsiSequenceCase[];

export const ansiOracleFixtures = [
  ...ansiCommandMatrixFixtures,
  backspaceWithoutOverwriteFixture,
  partialCsiCursorBackwardFixture,
  insertCharsFixture,
  deleteCharsFixture,
  insertLinesFixture,
  deleteLinesFixture,
  scrollRegionShiftFixture,
  originModeHomeFixture,
  insertModePrintFixture,
  decWraparoundToggleFixture,
  decSaveRestoreFixture,
  escIndexFixture,
  escNextLineFixture,
  escReverseIndexFixture,
  ansi16ColorsFixture,
  indexed256ColorsFixture,
  truecolorFixture
].filter(
  (fixture, index, fixtures) =>
    fixtures.findIndex((candidate) => candidate.name === fixture.name) === index
) satisfies RetroLcdTerminalFixture[];

export const ansiSupportGapLedger = [
  {
    id: "csi-horizontal-vertical-absolute",
    family: "csi",
    classification: "deferred",
    description:
      "Absolute horizontal and vertical cursor-addressing families like CHA, VPA, and HPA are not implemented yet.",
    examples: ["\u001b[12G", "\u001b[4d", "\u001b[10`"]
  },
  {
    id: "csi-repeat-and-erase-character",
    family: "csi",
    classification: "deferred",
    description:
      "Repeat-preceding-character and erase-character sequences are still missing from the parser and oracle suite.",
    examples: ["\u001b[5b", "\u001b[3X"]
  },
  {
    id: "csi-device-status-reports",
    family: "csi",
    classification: "host-only",
    description:
      "Device status reports and cursor-position queries need host reply behavior and are not yet modeled as terminal output tests.",
    examples: ["\u001b[5n", "\u001b[6n"]
  },
  {
    id: "tab-stop-management",
    family: "extended",
    classification: "deferred",
    description:
      "Setting and clearing tab stops is not implemented beyond fixed-width tab expansion.",
    examples: ["\u001bH", "\u001b[g", "\u001b[3g"]
  },
  {
    id: "osc-commands",
    family: "extended",
    classification: "deferred",
    description:
      "OSC title, palette, hyperlink, and clipboard sequences are outside the current parser and conformance surface.",
    examples: ["\u001b]0;title\u0007", "\u001b]8;;https://example.com\u0007link\u001b]8;;\u0007"]
  },
  {
    id: "dcs-and-apc-family",
    family: "extended",
    classification: "deferred",
    description:
      "DCS, APC, PM, and SOS command strings are not parsed or normalized today.",
    examples: ["\u001bP$qm\u001b\\", "\u001b_some payload\u001b\\"]
  },
  {
    id: "ss3-and-keypad-escapes",
    family: "extended",
    classification: "deferred",
    description:
      "SS3 and keypad escape families are still tracked as an unsupported parser gap.",
    examples: ["\u001bOA", "\u001bOP"]
  },
  {
    id: "charset-designation-and-locking-shifts",
    family: "extended",
    classification: "deferred",
    description:
      "Character-set designation escapes and locking shifts are not modeled yet.",
    examples: ["\u001b(B", "\u001b(0", "\u000e", "\u000f"]
  },
  {
    id: "c1-eight-bit-controls",
    family: "extended",
    classification: "deferred",
    description:
      "8-bit C1 control variants are not accepted as first-class parser input yet.",
    examples: ["\u009b31m", "\u009d0;title\u0007"]
  },
  {
    id: "unmodeled-dec-private-modes",
    family: "csi-private",
    classification: "deferred",
    description:
      "Only a targeted subset of DEC private modes is implemented; the rest are tracked explicitly as future conformance work.",
    examples: ["\u001b[?5h", "\u001b[?66h", "\u001b[?1048h"]
  }
] satisfies RetroLcdAnsiSupportGap[];
