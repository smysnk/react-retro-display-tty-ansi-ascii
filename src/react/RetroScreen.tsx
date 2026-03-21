import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent
} from "react";
import type { RetroLcdScreenSnapshot } from "../core/terminal/types";
import type { RetroLcdTerminalHostKeyEvent } from "../core/terminal/host-adapter";
import { encodeRetroLcdTerminalInput } from "../core/terminal/input-encoder";
import {
  encodeRetroLcdTerminalMouse,
  type RetroLcdTerminalMouseButton,
  type RetroLcdTerminalMouseEvent
} from "../core/terminal/mouse-encoder";
import {
  encodeRetroLcdTerminalFocusReport,
  encodeRetroLcdTerminalPaste
} from "../core/terminal/paste-encoder";
import type {
  RetroLcdPromptModeProps,
  RetroLcdProps,
  RetroLcdValueModeProps
} from "../core/types";
import { RetroScreenDisplay } from "./RetroScreenDisplay";
import { RetroScreenInputOverlay } from "./RetroScreenInputOverlay";
import { getDisplayModeRootVars } from "./retro-screen-display-color";
import { getDisplayPaddingVars } from "./retro-screen-display-padding";
import { getDisplayTypographyVars } from "./retro-screen-display-typography";
import {
  getRetroLcdPointerGridHit,
  getRetroLcdPointerGridPosition
} from "./retro-screen-pointer-grid";
import { useRetroLcdController } from "./useRetroScreenController";
import { useRetroLcdBufferViewport } from "./useRetroScreenBufferViewport";
import { useRetroLcdEditorSession } from "./useRetroScreenEditorSession";
import { useRetroLcdGeometry } from "./useRetroScreenGeometry";
import { useRetroLcdPromptSession } from "./useRetroScreenPromptSession";
import { useRetroLcdResizablePanel } from "./useRetroScreenResizablePanel";
import { useRetroScreenTerminalBridge } from "./useRetroScreenTerminalBridge";
import {
  buildTextRenderModel,
  getValueDisplayText,
  type RetroLcdRenderModel
} from "./retro-screen-render-model";
import { useRetroLcdTerminalRenderModel } from "./useRetroScreenTerminalRenderModel";

const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 46;

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const clampSelection = (value: number, text: string) =>
  Math.max(0, Math.min(text.length, Number.isFinite(value) ? Math.floor(value) : text.length));

const isMouseTrackingActive = (snapshot: RetroLcdScreenSnapshot) =>
  snapshot.modes.mouseTrackingMode !== "none" && snapshot.modes.mouseProtocol === "sgr";

const isEditorWordNavigationModifier = (event: KeyboardEvent<HTMLTextAreaElement>) =>
  event.altKey || event.ctrlKey || event.metaKey;

const isEditorSelectAllShortcut = (event: KeyboardEvent<HTMLTextAreaElement>) =>
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  event.key.toLowerCase() === "a";

const toTerminalMouseButton = (button: number): RetroLcdTerminalMouseButton | null => {
  switch (button) {
    case 0:
      return "left";
    case 1:
      return "middle";
    case 2:
      return "right";
    default:
      return null;
  }
};

const toTerminalHostKeyEvent = (
  event: KeyboardEvent<HTMLDivElement>
): RetroLcdTerminalHostKeyEvent => ({
  key: event.key,
  code: event.code,
  altKey: event.altKey,
  ctrlKey: event.ctrlKey,
  metaKey: event.metaKey,
  shiftKey: event.shiftKey,
  repeat: event.repeat
});

export function RetroScreen(props: RetroLcdProps) {
  const displayColorMode = props.displayColorMode ?? "phosphor-green";
  const displaySurfaceMode = props.displaySurfaceMode ?? "dark";
  const requestedCursorMode = props.cursorMode;
  const cursorMode = requestedCursorMode ?? "solid";
  const valueProps = props.mode === "value" ? props : null;
  const editorProps = props.mode === "editor" ? props : null;
  const terminalProps = props.mode === "terminal" ? props : null;
  const promptProps = props.mode === "prompt" ? props : null;
  const screenRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeMouseButtonRef = useRef<RetroLcdTerminalMouseButton>("none");
  const lastMouseCellRef = useRef<string | null>(null);
  const editorSelectionAnchorRef = useRef<number | null>(null);
  const editorSelectionDraggingRef = useRef(false);
  const previousEditableValueRef = useRef(valueProps?.value ?? "");
  const internalTerminalController = useRetroLcdController({
    rows: props.gridMode === "static" ? props.rows : undefined,
    cols: props.gridMode === "static" ? props.cols : undefined,
    scrollback: terminalProps?.bufferSize
  });
  const promptSession = useRetroLcdPromptSession({
    rows: props.gridMode === "static" ? props.rows ?? DEFAULT_ROWS : DEFAULT_ROWS,
    cols: props.gridMode === "static" ? props.cols ?? DEFAULT_COLS : DEFAULT_COLS,
    cursorMode,
    scrollback: promptProps?.bufferSize,
    promptChar: promptProps?.promptChar,
    acceptanceText: promptProps?.acceptanceText,
    rejectionText: promptProps?.rejectionText,
    onCommand: promptProps?.onCommand
  });
  const editorSession = useRetroLcdEditorSession({
    value: editorProps?.value,
    placeholder: editorProps?.placeholder,
    editable: editorProps?.editable,
    cursorMode
  });
  const [focused, setFocused] = useState(Boolean(props.autoFocus));
  const [selectionStart, setSelectionStart] = useState(0);
  const [promptDraft, setPromptDraft] = useState(promptSession.getDraft());
  const [editorState, setEditorState] = useState(() => editorSession.getState());
  const [promptSnapshot, setPromptSnapshot] = useState<RetroLcdScreenSnapshot>(() =>
    promptSession.getSnapshot()
  );
  const resizablePanel = useRetroLcdResizablePanel({
    resizable: props.resizable,
    resizableLeadingEdges: props.resizableLeadingEdges
  });
  const { geometry, cssVars } = useRetroLcdGeometry({
    screenRef,
    probeRef,
    gridMode: props.gridMode,
    rows: props.rows,
    cols: props.cols,
    fontScale: props.displayFontScale,
    onGeometryChange: props.onGeometryChange
  });
  const { snapshot: terminalSnapshot, terminalController } = useRetroLcdTerminalRenderModel({
    terminalProps,
    geometry,
    cursorMode,
    requestedCursorMode,
    internalController: internalTerminalController
  });
  const {
    sessionState,
    sessionTitle,
    sessionBellCount
  } = useRetroScreenTerminalBridge({
    terminalProps,
    geometry,
    terminalController
  });
  const captureTerminalKeyboard =
    terminalProps?.captureKeyboard ?? Boolean(terminalProps?.session || terminalProps?.onTerminalData);
  const captureTerminalMouse =
    terminalProps?.captureMouse ?? Boolean(terminalProps?.session || terminalProps?.onTerminalData);
  const captureTerminalPaste =
    terminalProps?.capturePaste ?? Boolean(terminalProps?.session || terminalProps?.onTerminalData);
  const captureTerminalFocusReport =
    terminalProps?.captureFocusReport ?? Boolean(terminalProps?.session || terminalProps?.onTerminalData);
  const terminalFocusable = terminalProps?.terminalFocusable ?? true;
  const localScrollbackWhenMouseActive = terminalProps?.localScrollbackWhenMouseActive ?? false;
  const bufferViewport = useRetroLcdBufferViewport({
    snapshot: props.mode === "terminal" ? terminalSnapshot : promptSnapshot,
    enabled: props.mode === "terminal" || props.mode === "prompt",
    defaultAutoFollow: terminalProps?.defaultAutoFollow ?? promptProps?.defaultAutoFollow ?? true
  });

  useEffect(() => {
    if (promptProps?.value !== undefined) {
      promptSession.setDraft(promptProps.value);
      promptSession.setSelection(promptProps.value.length);
    }
  }, [promptProps?.value, promptSession]);

  useEffect(() => {
    const syncEditorState = () => {
      setEditorState(editorSession.getState());
    };

    syncEditorState();
    return editorSession.subscribe(syncEditorState);
  }, [editorSession]);

  useEffect(() => {
    if (props.autoFocus) {
      if (props.mode === "terminal") {
        if (terminalFocusable) {
          viewportRef.current?.focus();
        }
        return;
      }

      inputRef.current?.focus();
    }
  }, [props.autoFocus, props.mode, terminalFocusable]);

  useEffect(() => {
    if (props.mode !== "value" || !valueProps) {
      previousEditableValueRef.current = "";
      return;
    }

    const nextValue = valueProps.value;
    const previousValue = previousEditableValueRef.current;
    previousEditableValueRef.current = nextValue;

    if (!valueProps.editable) {
      return;
    }

    const node = inputRef.current;
    const currentSelection = clampSelection(node?.selectionStart ?? selectionStart, previousValue);
    const appendedAtEnd =
      focused && nextValue.length >= previousValue.length && nextValue.startsWith(previousValue);
    const nextSelection =
      appendedAtEnd && currentSelection === previousValue.length
        ? nextValue.length
        : clampSelection(node?.selectionStart ?? currentSelection, nextValue);

    if (node && document.activeElement === node) {
      node.setSelectionRange(nextSelection, nextSelection);
    }

    setSelectionStart((current) => (current === nextSelection ? current : nextSelection));
  }, [focused, props.mode, selectionStart, valueProps?.editable, valueProps?.value]);

  useEffect(() => {
    if (!editorProps) {
      return;
    }

    const node = inputRef.current;
    if (!node) {
      return;
    }

    if (
      node.selectionStart !== editorState.selection.start ||
      node.selectionEnd !== editorState.selection.end
    ) {
      node.setSelectionRange(editorState.selection.start, editorState.selection.end);
    }
  }, [editorProps, editorState.selection.end, editorState.selection.start]);

  useEffect(() => {
    if (!editorProps) {
      return;
    }

    editorProps.onSelectionChange?.(editorState.selection);
  }, [editorProps?.onSelectionChange, editorState.selection]);

  useEffect(() => {
    promptSession.resize(geometry.rows, geometry.cols);
    if (requestedCursorMode) {
      promptSession.setCursorMode(requestedCursorMode);
    }
  }, [geometry.cols, geometry.rows, promptSession, requestedCursorMode]);

  useEffect(() => {
    const syncPromptState = () => {
      setPromptSnapshot(promptSession.getSnapshot());
      setPromptDraft(promptSession.getDraft());
    };

    syncPromptState();
    return promptSession.subscribe(syncPromptState);
  }, [promptSession]);

  const renderModel = useMemo<RetroLcdRenderModel>(() => {
    if (props.mode === "terminal") {
      return bufferViewport.renderModel;
    }

    if (promptProps) {
      return bufferViewport.renderModel;
    }

    if (editorProps) {
      const hasValue = editorState.value.length > 0;
      const text = hasValue ? editorState.value : !focused ? editorState.placeholder : "";
      return buildTextRenderModel({
        text,
        geometry,
        cursorMode: editorState.cursorMode,
        cursorVisible: Boolean(editorState.editable && focused),
        cursorOffset: hasValue || focused ? editorState.selection.end : 0,
        dimmed: !hasValue && !focused && Boolean(editorState.placeholder),
        selection: hasValue ? editorState.selection : null,
        includeSourceOffsets: true
      });
    }

    const nextValueProps = valueProps as RetroLcdValueModeProps;
    const { text, dimmed } = getValueDisplayText(nextValueProps, focused);
    return buildTextRenderModel({
      text,
      geometry,
      cursorMode,
      cursorVisible: Boolean(valueProps?.editable && focused),
      cursorOffset: selectionStart,
      dimmed
    });
  }, [
    cursorMode,
    bufferViewport.renderModel,
    editorProps,
    editorState,
    focused,
    geometry,
    props.mode,
    selectionStart,
    valueProps
  ]);

  const syncSelection = () => {
    const node = inputRef.current;

    if (!node) {
      return;
    }

    const nextSelection = clampSelection(node.selectionStart ?? node.value.length, node.value);
    if (promptProps) {
      promptSession.setSelection(nextSelection);
      return;
    }

    if (editorProps) {
      editorSession.setSelection(
        clampSelection(node.selectionStart ?? nextSelection, node.value),
        clampSelection(node.selectionEnd ?? nextSelection, node.value)
      );
      return;
    }

    setSelectionStart(nextSelection);
  };

  const focusInput = () => {
    if (props.mode === "terminal") {
      if (terminalFocusable) {
        viewportRef.current?.focus();
      }
      return;
    }

    inputRef.current?.focus();
  };

  const handleBufferNavigationKey = (key: string) => {
    if (props.mode !== "terminal" && props.mode !== "prompt") {
      return false;
    }

    if (props.mode === "prompt" && (key === "Home" || key === "End")) {
      return false;
    }

    return bufferViewport.handleNavigationKey(key);
  };

  const handleValueSubmit = () => {
    if (valueProps) {
      valueProps.onSubmit?.(valueProps.value);
    }
  };

  const emitEditorValueChange = (nextValue: string) => {
    editorSession.setValue(nextValue);
    editorProps?.onChange?.(nextValue);
  };

  const handlePromptSubmit = async () => {
    if (!promptProps) {
      return;
    }

    await promptSession.submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (handleBufferNavigationKey(event.key)) {
      event.preventDefault();
      return;
    }

    if (editorProps) {
      if (isEditorSelectAllShortcut(event)) {
        event.preventDefault();
        editorSession.selectAll();
        return;
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "Home" ||
        event.key === "End"
      ) {
        const direction = event.key === "ArrowLeft" || event.key === "Home" ? -1 : 1;
        const isBoundaryMove = event.key === "Home" || event.key === "End";
        const isWordMove =
          !isBoundaryMove &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
          isEditorWordNavigationModifier(event);

        event.preventDefault();

        if (event.shiftKey) {
          if (isBoundaryMove) {
            editorSession.extendSelectionToBoundary(direction);
            return;
          }

          if (isWordMove) {
            editorSession.extendSelectionByWord(direction);
            return;
          }

          editorSession.extendSelectionByCharacter(direction);
          return;
        }

        if (isBoundaryMove) {
          editorSession.moveCursorToBoundary(direction);
          return;
        }

        if (isWordMove) {
          editorSession.moveCursorByWord(direction);
          return;
        }

        editorSession.moveCursorByCharacter(direction);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        if (editorSession.deleteBackward()) {
          emitEditorValueChange(editorSession.getValue());
        }
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        if (editorSession.deleteForward()) {
          emitEditorValueChange(editorSession.getValue());
        }
        return;
      }

      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    if (props.mode === "value" && event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (props.mode === "prompt") {
      void handlePromptSubmit();
      return;
    }

    handleValueSubmit();
  };

  const handleEditorCopy = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!editorProps) {
      return;
    }

    const selectedText = editorSession.getSelectedText();
    if (!selectedText) {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData("text/plain", selectedText);
  };

  const handleEditorCut = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!editorProps) {
      return;
    }

    const selectedText = editorSession.getSelectedText();
    if (!selectedText) {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData("text/plain", selectedText);

    if (!editorSession.isEditable()) {
      return;
    }

    const result = editorSession.cutSelection();
    if (result.changed) {
      emitEditorValueChange(editorSession.getValue());
    }
  };

  const handleEditorPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!editorProps) {
      return;
    }

    const pastedText = event.clipboardData.getData("text/plain");
    if (!pastedText) {
      return;
    }

    event.preventDefault();

    if (!editorSession.isEditable()) {
      return;
    }

    if (editorSession.replaceSelection(pastedText)) {
      emitEditorValueChange(editorSession.getValue());
    }
  };

  const handleValueInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (!valueProps) {
      return;
    }

    valueProps.onChange?.(event.currentTarget.value);
    syncSelection();
  };

  const handleEditorInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (!editorProps) {
      return;
    }

    if (!editorSession.isEditable()) {
      event.currentTarget.value = editorState.value;
      event.currentTarget.setSelectionRange(
        editorState.selection.start,
        editorState.selection.end
      );
      return;
    }

    const nextValue = event.currentTarget.value;
    editorSession.setValue(nextValue);
    editorSession.setSelection(
      clampSelection(event.currentTarget.selectionStart ?? nextValue.length, nextValue),
      clampSelection(event.currentTarget.selectionEnd ?? nextValue.length, nextValue)
    );
    editorProps.onChange?.(nextValue);
  };

  const handlePromptInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (!promptProps) {
      return;
    }

    promptSession.setDraft(event.currentTarget.value);
    const nextSelection = clampSelection(
      event.currentTarget.selectionStart ?? event.currentTarget.value.length,
      event.currentTarget.value
    );
    promptSession.setSelection(nextSelection);
  };

  const handleViewportKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.mode !== "terminal") {
      return;
    }

    if (event.nativeEvent.isComposing || event.key === "Process" || event.key === "Dead") {
      return;
    }

    const terminalKeyEvent = toTerminalHostKeyEvent(event);
    terminalProps?.onTerminalKeyDown?.(terminalKeyEvent);

    if (captureTerminalKeyboard) {
      const encodedInput = encodeRetroLcdTerminalInput(terminalKeyEvent, {
        applicationCursorKeysMode: terminalSnapshot.modes.applicationCursorKeysMode
      });

      if (encodedInput !== null) {
        event.preventDefault();
        emitTerminalData(encodedInput);
        return;
      }
    }

    if (handleBufferNavigationKey(event.key)) {
      event.preventDefault();
    }
  };

  const handleViewportKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.mode !== "terminal") {
      return;
    }

    terminalProps?.onTerminalKeyUp?.(toTerminalHostKeyEvent(event));
  };

  const emitTerminalData = (data: string | Uint8Array) => {
    terminalProps?.onTerminalData?.(data);
    terminalProps?.session?.writeInput(data);
  };

  const terminalMouseReportingActive =
    props.mode === "terminal" && captureTerminalMouse && isMouseTrackingActive(terminalSnapshot);

  const emitTerminalMouse = (event: RetroLcdTerminalMouseEvent) => {
    if (props.mode !== "terminal") {
      return false;
    }

    const encodedData = encodeRetroLcdTerminalMouse(event, {
      protocol: terminalSnapshot.modes.mouseProtocol,
      trackingMode: terminalSnapshot.modes.mouseTrackingMode
    });
    if (!encodedData) {
      return false;
    }

    terminalProps?.onTerminalMouse?.({
      ...event,
      encodedData
    });
    emitTerminalData(encodedData);
    return true;
  };

  const buildTerminalMouseEvent = (
    event: MouseEvent<HTMLDivElement>,
    action: RetroLcdTerminalMouseEvent["action"],
    button: RetroLcdTerminalMouseButton
  ): RetroLcdTerminalMouseEvent | null => {
    const screenNode = screenRef.current;
    if (!screenNode) {
      return null;
    }

    const { row, col } = getRetroLcdPointerGridPosition({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: screenNode.getBoundingClientRect(),
      geometry
    });

    return {
      action,
      button,
      row,
      col,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    };
  };

  const buildWheelTerminalMouseEvent = (
    event: WheelEvent<HTMLDivElement>
  ): RetroLcdTerminalMouseEvent | null => {
    if (event.deltaY === 0) {
      return null;
    }

    const screenNode = screenRef.current;
    if (!screenNode) {
      return null;
    }

    const { row, col } = getRetroLcdPointerGridPosition({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: screenNode.getBoundingClientRect(),
      geometry
    });

    return {
      action: "wheel",
      button: event.deltaY < 0 ? "wheel-up" : "wheel-down",
      row,
      col,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    };
  };

  const maybeEmitFocusReport = (focusedState: boolean) => {
    if (
      props.mode !== "terminal" ||
      !captureTerminalFocusReport ||
      !terminalSnapshot.modes.focusReportingMode
    ) {
      return;
    }

    emitTerminalData(encodeRetroLcdTerminalFocusReport(focusedState));
  };

  const handleViewportPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (props.mode !== "terminal" || !captureTerminalPaste) {
      return;
    }

    const pastedText = event.clipboardData.getData("text/plain");
    if (!pastedText) {
      return;
    }

    event.preventDefault();
    emitTerminalData(
      encodeRetroLcdTerminalPaste(pastedText, {
        bracketedPasteMode: terminalSnapshot.modes.bracketedPasteMode
      })
    );
  };

  const getEditorSelectionOffset = (event: MouseEvent<HTMLDivElement>) => {
    if (!editorProps) {
      return null;
    }

    if (editorState.value.length === 0) {
      return 0;
    }

    const screenNode = screenRef.current;
    const cellRows = renderModel.cells;
    if (!screenNode || !cellRows) {
      return null;
    }

    const hit = getRetroLcdPointerGridHit({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: screenNode.getBoundingClientRect(),
      geometry
    });
    const rowCells = cellRows[hit.row - 1] ?? [];

    if (rowCells.length === 0) {
      return editorState.value.length;
    }

    if (hit.col - 1 >= rowCells.length) {
      const lastCell = rowCells[rowCells.length - 1];
      return (lastCell?.sourceOffset ?? editorState.value.length) + 1;
    }

    const cell = rowCells[hit.col - 1];
    const baseOffset = cell?.sourceOffset ?? editorState.value.length;
    return hit.cellRatioX >= 0.5 ? baseOffset + 1 : baseOffset;
  };

  const handleViewportMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (editorProps) {
      const nextOffset = getEditorSelectionOffset(event);
      if (nextOffset === null) {
        return;
      }

      editorSelectionDraggingRef.current = true;
      editorSelectionAnchorRef.current = nextOffset;
      editorSession.setSelection(nextOffset, nextOffset);
      focusInput();
      event.preventDefault();
      return;
    }

    if (!terminalMouseReportingActive) {
      return;
    }

    const button = toTerminalMouseButton(event.button);
    if (!button) {
      return;
    }

    const mouseEvent = buildTerminalMouseEvent(event, "press", button);
    if (!mouseEvent) {
      return;
    }

    activeMouseButtonRef.current = button;
    lastMouseCellRef.current = `${mouseEvent.row}:${mouseEvent.col}:${button}`;
    event.preventDefault();
    emitTerminalMouse(mouseEvent);
  };

  const handleViewportMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (editorProps) {
      if (!editorSelectionDraggingRef.current) {
        return;
      }

      const anchor = editorSelectionAnchorRef.current;
      const nextOffset = getEditorSelectionOffset(event);
      if (anchor === null || nextOffset === null) {
        return;
      }

      editorSession.setSelection(anchor, nextOffset);
      event.preventDefault();
      return;
    }

    if (!terminalMouseReportingActive) {
      return;
    }

    const activeButton = activeMouseButtonRef.current;
    const button =
      activeButton !== "none"
        ? activeButton
        : terminalSnapshot.modes.mouseTrackingMode === "any"
          ? "none"
          : null;
    if (!button) {
      return;
    }

    const mouseEvent = buildTerminalMouseEvent(event, "move", button);
    if (!mouseEvent) {
      return;
    }

    const cellKey = `${mouseEvent.row}:${mouseEvent.col}:${button}`;
    if (cellKey === lastMouseCellRef.current) {
      return;
    }

    lastMouseCellRef.current = cellKey;
    event.preventDefault();
    emitTerminalMouse(mouseEvent);
  };

  const handleViewportMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    if (editorProps) {
      if (!editorSelectionDraggingRef.current) {
        return;
      }

      const anchor = editorSelectionAnchorRef.current;
      const nextOffset = getEditorSelectionOffset(event);
      editorSelectionDraggingRef.current = false;
      editorSelectionAnchorRef.current = null;

      if (anchor === null || nextOffset === null) {
        return;
      }

      editorSession.setSelection(anchor, nextOffset);
      event.preventDefault();
      return;
    }

    if (!terminalMouseReportingActive) {
      activeMouseButtonRef.current = "none";
      lastMouseCellRef.current = null;
      return;
    }

    const button = toTerminalMouseButton(event.button) ?? activeMouseButtonRef.current;
    if (button === "none") {
      return;
    }

    const mouseEvent = buildTerminalMouseEvent(event, "release", button);
    activeMouseButtonRef.current = "none";
    lastMouseCellRef.current = null;
    if (!mouseEvent) {
      return;
    }

    event.preventDefault();
    emitTerminalMouse(mouseEvent);
  };

  const handleViewportDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!editorProps) {
      return;
    }

    const nextOffset = getEditorSelectionOffset(event);
    if (nextOffset === null) {
      return;
    }

    editorSelectionDraggingRef.current = false;
    editorSelectionAnchorRef.current = null;
    editorSession.selectWordAt(nextOffset);
    focusInput();
    event.preventDefault();
  };

  const handleViewportContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (terminalMouseReportingActive) {
      event.preventDefault();
    }
  };

  const handleViewportWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (
      props.mode === "terminal" &&
      terminalMouseReportingActive &&
      !localScrollbackWhenMouseActive
    ) {
      const mouseEvent = buildWheelTerminalMouseEvent(event);
      if (mouseEvent && emitTerminalMouse(mouseEvent)) {
        event.preventDefault();
      }
      return;
    }

    if (
      (props.mode === "terminal" || props.mode === "prompt") &&
      bufferViewport.handleWheelDelta(event.deltaY)
    ) {
      event.preventDefault();
    }
  };

  const inlineStyle = {
    "--retro-lcd-rows": `${geometry.rows}`,
    "--retro-lcd-cols": `${geometry.cols}`,
    ...getDisplayModeRootVars(displayColorMode, displaySurfaceMode, props.color),
    ...getDisplayPaddingVars(props.displayPadding),
    ...getDisplayTypographyVars(props.displayFontScale, props.displayRowScale),
    ...cssVars,
    ...props.style,
    ...resizablePanel.inlineSizeStyle
  } as CSSProperties;

  return (
    <div
      ref={resizablePanel.rootRef}
      className={joinClassNames("retro-lcd", props.className)}
      style={inlineStyle}
      data-mode={props.mode}
      data-cursor-mode={renderModel.cursor?.mode ?? cursorMode}
      data-rows={geometry.rows}
      data-cols={geometry.cols}
      data-grid-mode={props.gridMode ?? "auto"}
      data-display-color-mode={displayColorMode}
      data-display-surface-mode={displaySurfaceMode}
      data-resizable={resizablePanel.isResizable ? "true" : undefined}
      data-resizable-mode={resizablePanel.isResizable ? resizablePanel.resizeMode : undefined}
      data-resizable-leading-edges={resizablePanel.hasLeadingHandles ? "true" : undefined}
      data-resizing={resizablePanel.isResizing ? "true" : undefined}
      data-placeholder={renderModel.isDimmed ? "true" : "false"}
      data-buffer-offset={bufferViewport.viewportState.scrollOffset}
      data-buffer-max-offset={bufferViewport.viewportState.maxScrollOffset}
      data-auto-follow={bufferViewport.viewportState.autoFollow ? "true" : "false"}
      data-terminal-mouse-tracking={props.mode === "terminal" ? terminalSnapshot.modes.mouseTrackingMode : undefined}
      data-terminal-mouse-protocol={props.mode === "terminal" ? terminalSnapshot.modes.mouseProtocol : undefined}
      data-terminal-alternate-screen={
        props.mode === "terminal" ? (terminalSnapshot.modes.alternateScreenBufferMode ? "true" : "false") : undefined
      }
      data-session-state={props.mode === "terminal" ? sessionState : undefined}
      data-session-title={props.mode === "terminal" ? sessionTitle ?? undefined : undefined}
      data-session-bell-count={props.mode === "terminal" ? String(sessionBellCount) : undefined}
    >
      <div className="retro-lcd__bezel" aria-hidden="true" />
      <RetroScreenDisplay
        mode={props.mode}
        renderModel={renderModel}
        displayColorMode={displayColorMode}
        displaySurfaceMode={displaySurfaceMode}
        screenRef={screenRef}
        probeRef={probeRef}
        viewportRef={viewportRef}
        onViewportClick={focusInput}
        onViewportFocus={
          props.mode === "terminal"
            ? () => {
                setFocused(true);
                maybeEmitFocusReport(true);
                props.onFocusChange?.(true);
              }
            : undefined
        }
        onViewportBlur={
          props.mode === "terminal"
            ? () => {
                setFocused(false);
                maybeEmitFocusReport(false);
                props.onFocusChange?.(false);
              }
            : undefined
        }
        onViewportPaste={props.mode === "terminal" ? handleViewportPaste : undefined}
        onViewportKeyDown={handleViewportKeyDown}
        onViewportKeyUp={handleViewportKeyUp}
        onViewportMouseDown={
          props.mode === "terminal" || props.mode === "editor" ? handleViewportMouseDown : undefined
        }
        onViewportMouseMove={
          props.mode === "terminal" || props.mode === "editor" ? handleViewportMouseMove : undefined
        }
        onViewportMouseUp={
          props.mode === "terminal" || props.mode === "editor" ? handleViewportMouseUp : undefined
        }
        onViewportDoubleClick={props.mode === "editor" ? handleViewportDoubleClick : undefined}
        onViewportContextMenu={props.mode === "terminal" ? handleViewportContextMenu : undefined}
        onViewportWheel={handleViewportWheel}
        viewportTabIndex={props.mode === "terminal" && terminalFocusable ? 0 : undefined}
      >
        <RetroScreenInputOverlay
          inputRef={inputRef}
          visible={
            props.mode === "prompt" ||
            props.mode === "editor" ||
            (props.mode === "value" && Boolean(props.editable))
          }
          value={
            promptProps
              ? promptProps.value ?? promptDraft
              : editorProps
                ? editorState.value
                : valueProps?.value ?? ""
          }
          style={editorProps ? { pointerEvents: "none" } : undefined}
          onFocus={() => {
            if (promptProps) {
              promptSession.setFocused(true);
              promptSession.setSelection(
                clampSelection(
                  inputRef.current?.selectionStart ?? inputRef.current?.value.length ?? 0,
                  inputRef.current?.value ?? ""
                )
              );
            } else if (editorProps) {
              setFocused(true);
              if (!editorSelectionDraggingRef.current) {
                editorSession.setSelection(
                  clampSelection(
                    inputRef.current?.selectionStart ?? inputRef.current?.value.length ?? 0,
                    inputRef.current?.value ?? ""
                  ),
                  clampSelection(
                    inputRef.current?.selectionEnd ?? inputRef.current?.value.length ?? 0,
                    inputRef.current?.value ?? ""
                  )
                );
              }
            } else {
              setFocused(true);
              setSelectionStart(
                clampSelection(
                  inputRef.current?.selectionStart ?? inputRef.current?.value.length ?? 0,
                  inputRef.current?.value ?? ""
                )
              );
            }
            props.onFocusChange?.(true);
          }}
          onBlur={() => {
            if (promptProps) {
              promptSession.setFocused(false);
            } else if (editorProps) {
              setFocused(false);
            } else {
              setFocused(false);
            }
            props.onFocusChange?.(false);
          }}
          onSelect={syncSelection}
          onKeyUp={syncSelection}
          onMouseUp={syncSelection}
          onKeyDown={handleKeyDown}
          onCopy={props.mode === "editor" ? handleEditorCopy : undefined}
          onCut={props.mode === "editor" ? handleEditorCut : undefined}
          onPaste={props.mode === "editor" ? handleEditorPaste : undefined}
          onInput={
            props.mode === "prompt"
              ? handlePromptInput
              : props.mode === "editor"
                ? handleEditorInput
                : handleValueInput
          }
          spellCheck={false}
          readOnly={props.mode === "editor" ? !editorProps?.editable : undefined}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={
            props.mode === "prompt"
              ? "Retro LCD prompt"
              : props.mode === "editor"
                ? "Retro LCD editor"
                : "Retro LCD input"
          }
        />
      </RetroScreenDisplay>
      {resizablePanel.isResizable ? (
        <>
          {resizablePanel.resizeMode === "width" || resizablePanel.resizeMode === "both" ? (
            <div
              className="retro-lcd__resize-handle retro-lcd__resize-handle--width"
              data-resize-handle="right"
              data-active={resizablePanel.activeHandle === "right" ? "true" : undefined}
              onMouseDown={resizablePanel.beginResize("right")}
              aria-hidden="true"
            />
          ) : null}
          {resizablePanel.resizeMode === "height" || resizablePanel.resizeMode === "both" ? (
            <div
              className="retro-lcd__resize-handle retro-lcd__resize-handle--height"
              data-resize-handle="bottom"
              data-active={resizablePanel.activeHandle === "bottom" ? "true" : undefined}
              onMouseDown={resizablePanel.beginResize("bottom")}
              aria-hidden="true"
            />
          ) : null}
          {resizablePanel.resizeMode === "both" ? (
            <div
              className="retro-lcd__resize-handle retro-lcd__resize-handle--corner"
              data-resize-handle="bottom-right"
              data-active={resizablePanel.activeHandle === "bottom-right" ? "true" : undefined}
              onMouseDown={resizablePanel.beginResize("bottom-right")}
              aria-hidden="true"
            />
          ) : null}
          {resizablePanel.hasLeadingHandles &&
          (resizablePanel.resizeMode === "width" || resizablePanel.resizeMode === "both") ? (
            <div
              className="retro-lcd__resize-handle retro-lcd__resize-handle--left"
              data-resize-handle="left"
              data-active={resizablePanel.activeHandle === "left" ? "true" : undefined}
              onMouseDown={resizablePanel.beginResize("left")}
              aria-hidden="true"
            />
          ) : null}
          {resizablePanel.hasLeadingHandles &&
          (resizablePanel.resizeMode === "height" || resizablePanel.resizeMode === "both") ? (
            <div
              className="retro-lcd__resize-handle retro-lcd__resize-handle--top"
              data-resize-handle="top"
              data-active={resizablePanel.activeHandle === "top" ? "true" : undefined}
              onMouseDown={resizablePanel.beginResize("top")}
              aria-hidden="true"
            />
          ) : null}
          {resizablePanel.hasLeadingHandles && resizablePanel.resizeMode === "both" ? (
            <div
              className="retro-lcd__resize-handle retro-lcd__resize-handle--top-left"
              data-resize-handle="top-left"
              data-active={resizablePanel.activeHandle === "top-left" ? "true" : undefined}
              onMouseDown={resizablePanel.beginResize("top-left")}
              aria-hidden="true"
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export const RetroLcd = RetroScreen;
