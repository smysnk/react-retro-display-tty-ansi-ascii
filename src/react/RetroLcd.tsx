import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent
} from "react";
import type { RetroLcdScreenSnapshot } from "../core/terminal/types";
import type {
  RetroLcdPromptModeProps,
  RetroLcdProps,
  RetroLcdValueModeProps
} from "../core/types";
import { RetroLcdDisplay } from "./RetroLcdDisplay";
import { RetroLcdInputOverlay } from "./RetroLcdInputOverlay";
import { getDisplayModeRootVars } from "./retro-lcd-display-color";
import { useRetroLcdController } from "./useRetroLcdController";
import { useRetroLcdGeometry } from "./useRetroLcdGeometry";
import { useRetroLcdPromptSession } from "./useRetroLcdPromptSession";
import {
  buildTextRenderModel,
  getValueDisplayText,
  snapshotToRenderModel,
  type RetroLcdRenderModel
} from "./retro-lcd-render-model";
import { useRetroLcdTerminalRenderModel } from "./useRetroLcdTerminalRenderModel";

const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 46;

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const clampSelection = (value: number, text: string) =>
  Math.max(0, Math.min(text.length, Number.isFinite(value) ? Math.floor(value) : text.length));

export function RetroLcd(props: RetroLcdProps) {
  const displayColorMode = props.displayColorMode ?? "phosphor-green";
  const requestedCursorMode = props.cursorMode;
  const cursorMode = requestedCursorMode ?? "solid";
  const valueProps = props.mode === "value" ? props : null;
  const terminalProps = props.mode === "terminal" ? props : null;
  const promptProps = props.mode === "prompt" ? props : null;
  const screenRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const previousEditableValueRef = useRef(valueProps?.value ?? "");
  const internalTerminalController = useRetroLcdController();
  const promptSession = useRetroLcdPromptSession({
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    cursorMode,
    promptChar: promptProps?.promptChar,
    acceptanceText: promptProps?.acceptanceText,
    rejectionText: promptProps?.rejectionText,
    onCommand: promptProps?.onCommand
  });
  const [focused, setFocused] = useState(Boolean(props.autoFocus));
  const [selectionStart, setSelectionStart] = useState(0);
  const [promptDraft, setPromptDraft] = useState(promptSession.getDraft());
  const [promptSnapshot, setPromptSnapshot] = useState<RetroLcdScreenSnapshot>(() =>
    promptSession.getSnapshot()
  );
  const { geometry, cssVars } = useRetroLcdGeometry({
    screenRef,
    probeRef,
    onGeometryChange: props.onGeometryChange
  });
  const { renderModel: terminalRenderModel } = useRetroLcdTerminalRenderModel({
    terminalProps,
    geometry,
    cursorMode,
    requestedCursorMode,
    internalController: internalTerminalController
  });

  useEffect(() => {
    if (promptProps?.value !== undefined) {
      promptSession.setDraft(promptProps.value);
      promptSession.setSelection(promptProps.value.length);
    }
  }, [promptProps?.value, promptSession]);

  useEffect(() => {
    if (props.autoFocus) {
      inputRef.current?.focus();
    }
  }, [props.autoFocus]);

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
      return terminalRenderModel;
    }

    if (promptProps) {
      return snapshotToRenderModel(promptSnapshot);
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
    focused,
    geometry,
    promptSnapshot,
    props.mode,
    selectionStart,
    terminalRenderModel
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

    setSelectionStart(nextSelection);
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const handleValueSubmit = () => {
    if (valueProps) {
      valueProps.onSubmit?.(valueProps.value);
    }
  };

  const handlePromptSubmit = async () => {
    if (!promptProps) {
      return;
    }

    await promptSession.submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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

  const handleValueInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (!valueProps) {
      return;
    }

    valueProps.onChange?.(event.currentTarget.value);
    syncSelection();
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

  const inlineStyle = {
    "--retro-lcd-rows": `${geometry.rows}`,
    "--retro-lcd-cols": `${geometry.cols}`,
    ...getDisplayModeRootVars(displayColorMode, props.color),
    ...cssVars,
    ...props.style
  } as CSSProperties;

  return (
    <div
      className={joinClassNames("retro-lcd", props.className)}
      style={inlineStyle}
      data-mode={props.mode}
      data-cursor-mode={renderModel.cursor?.mode ?? cursorMode}
      data-rows={geometry.rows}
      data-cols={geometry.cols}
      data-display-color-mode={displayColorMode}
      data-placeholder={renderModel.isDimmed ? "true" : "false"}
    >
      <div className="retro-lcd__bezel" aria-hidden="true" />
      <RetroLcdDisplay
        mode={props.mode}
        renderModel={renderModel}
        displayColorMode={displayColorMode}
        screenRef={screenRef}
        probeRef={probeRef}
        onViewportClick={focusInput}
      >
        <RetroLcdInputOverlay
          inputRef={inputRef}
          visible={props.mode === "prompt" || (props.mode === "value" && Boolean(props.editable))}
          value={promptProps ? promptProps.value ?? promptDraft : valueProps?.value ?? ""}
          onFocus={() => {
            if (promptProps) {
              promptSession.setFocused(true);
              promptSession.setSelection(
                clampSelection(
                  inputRef.current?.selectionStart ?? inputRef.current?.value.length ?? 0,
                  inputRef.current?.value ?? ""
                )
              );
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
            } else {
              setFocused(false);
            }
            props.onFocusChange?.(false);
          }}
          onSelect={syncSelection}
          onKeyUp={syncSelection}
          onMouseUp={syncSelection}
          onKeyDown={handleKeyDown}
          onInput={props.mode === "prompt" ? handlePromptInput : handleValueInput}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={props.mode === "prompt" ? "Retro LCD prompt" : "Retro LCD input"}
        />
      </RetroLcdDisplay>
    </div>
  );
}
