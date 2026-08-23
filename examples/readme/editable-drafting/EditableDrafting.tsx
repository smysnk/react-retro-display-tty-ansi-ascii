import { useState } from "react";
import { RetroScreen } from "react-retro-display-tty-ansi-ascii";
import "react-retro-display-tty-ansi-ascii/styles.css";

export function EditableDrafting() {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState("Nothing submitted yet.");

  return (
    <>
      <RetroScreen
        mode="value"
        value={value}
        editable
        autoFocus
        color="#97ff9b"
        cursorMode="solid"
        placeholder="Write a line, breathe, then press Enter."
        onChange={setValue}
        onSubmit={(nextValue) => {
          setSubmitted(nextValue.length > 0 ? nextValue : "(empty)");
        }}
      />
      <output>Last Enter press: {submitted}</output>
    </>
  );
}
