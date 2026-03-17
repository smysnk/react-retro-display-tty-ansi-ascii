import type { RefObject, TextareaHTMLAttributes } from "react";

type RetroLcdInputOverlayProps = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  visible: boolean;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function RetroLcdInputOverlay({
  inputRef,
  visible,
  ...props
}: RetroLcdInputOverlayProps) {
  if (!visible) {
    return null;
  }

  return <textarea ref={inputRef} className="retro-lcd__input" rows={1} {...props} />;
}
