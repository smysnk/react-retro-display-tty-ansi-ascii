import type { RefObject, TextareaHTMLAttributes } from "react";

type RetroScreenInputOverlayProps = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  visible: boolean;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function RetroScreenInputOverlay({
  inputRef,
  visible,
  ...props
}: RetroScreenInputOverlayProps) {
  if (!visible) {
    return null;
  }

  return <textarea ref={inputRef} className="retro-lcd__input" rows={1} {...props} />;
}
