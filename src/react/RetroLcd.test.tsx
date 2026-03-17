import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { RetroLcd } from "./RetroLcd";
import { createRetroLcdController } from "../core/terminal/controller";
import { wrapTextToColumns } from "../core/geometry/wrap";

const getBodyText = (container: HTMLElement) =>
  container.querySelector(".retro-lcd__body")?.textContent?.replace(/\u00a0/gu, " ") ?? "";

describe("RetroLcd", () => {
  it("renders value mode text", () => {
    render(<RetroLcd mode="value" value="HELLO LCD" />);

    expect(screen.getByText("HELLO LCD")).toBeInTheDocument();
  });

  it("wraps long value-mode text into measured columns", () => {
    const text = "X".repeat(50);
    const { container } = render(<RetroLcd mode="value" value={text} />);

    const lines = Array.from(container.querySelectorAll(".retro-lcd__line"))
      .map((line) => line.textContent)
      .filter((line) => line && line.trim().length > 0);

    expect(lines[0]).toBe("X".repeat(46));
    expect(lines[1]).toBe("XXXX");
  });

  it("renders terminal mode buffer text and updates from a controller", () => {
    const controller = createRetroLcdController({
      rows: 3,
      cols: 24,
      cursorMode: "hollow"
    });
    const { container } = render(<RetroLcd mode="terminal" controller={controller} />);

    act(() => {
      controller.write("line one");
      controller.writeln(" and more");
      controller.write("line two");
    });

    const bodyText = getBodyText(container);
    expect(bodyText).toContain("line one");
    expect(bodyText).toContain("line two");
    expect(container.querySelector(".retro-lcd__cursor")).toHaveAttribute(
      "data-cursor-mode",
      "hollow"
    );
  });

  it("renders ansi cell styles from terminal snapshots", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 8 });
    const { container } = render(<RetroLcd mode="terminal" controller={controller} />);

    act(() => {
      controller.write("\u001b[1mA\u001b[2mB\u001b[7mC\u001b[8mD\u001b[5mE");
    });

    expect(container.querySelector(".retro-lcd__cell--bold")).not.toBeNull();
    expect(container.querySelector(".retro-lcd__cell--faint")).not.toBeNull();
    expect(container.querySelector(".retro-lcd__cell--inverse")).not.toBeNull();
    expect(container.querySelector(".retro-lcd__cell--conceal")).not.toBeNull();
    expect(container.querySelector(".retro-lcd__cell--blink")).not.toBeNull();
  });

  it("projects ANSI semantic colors through the ansi-classic display mode", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 8 });
    const { container } = render(
      <RetroLcd mode="terminal" controller={controller} displayColorMode="ansi-classic" />
    );

    act(() => {
      controller.write("\u001b[31;44mA");
    });

    const cell = container.querySelector(".retro-lcd__cell") as HTMLElement | null;
    expect(cell).not.toBeNull();
    expect(window.getComputedStyle(cell!).color).not.toBe("rgb(151, 255, 155)");
    expect(window.getComputedStyle(cell!).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });

  it("projects indexed and truecolor cells through the ansi-extended display mode", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 8 });
    const { container } = render(
      <RetroLcd mode="terminal" controller={controller} displayColorMode="ansi-extended" />
    );

    act(() => {
      controller.write("\u001b[38;5;196;48;5;25mA\u001b[38;2;17;34;51;48;2;68;85;102mB");
    });

    const cells = Array.from(container.querySelectorAll(".retro-lcd__cell")) as HTMLElement[];
    expect(cells.length).toBeGreaterThanOrEqual(2);
    expect(window.getComputedStyle(cells[0]!).color).toBe("rgb(255, 0, 0)");
    expect(window.getComputedStyle(cells[1]!).color).toBe("rgb(17, 34, 51)");
    expect(window.getComputedStyle(cells[1]!).backgroundColor).toBe("rgb(68, 85, 102)");
  });

  it("renders prompt mode with the default prompt character", () => {
    const { container } = render(<RetroLcd mode="prompt" value="status" />);

    expect(getBodyText(container)).toContain("> status");
  });

  it("submits accepted prompt commands and prints the response protocol", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn(async () => ({
      accepted: true as const,
      response: ["alpha", "beta"]
    }));
    const view = render(<RetroLcd mode="prompt" onCommand={onCommand} autoFocus />);
    const { container } = view;

    const input = container.querySelector(".retro-lcd__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();
    await user.type(input!, "help{enter}");

    expect(onCommand).toHaveBeenCalledWith("help");
    const bodyText = getBodyText(container);
    expect(bodyText).toContain("> help");
    expect(bodyText).toContain("OK");
    expect(bodyText).toContain("alpha");
    expect(bodyText).toContain("beta");
    expect(bodyText).toContain("> ");
  });

  it("submits rejected prompt commands with ERROR", async () => {
    const user = userEvent.setup();
    const view = render(
      <RetroLcd
        mode="prompt"
        onCommand={async () => ({
          accepted: false as const
        })}
        autoFocus
      />
    );
    const { container } = view;

    const input = container.querySelector(".retro-lcd__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();
    await user.type(input!, "bad{enter}");

    const bodyText = getBodyText(container);
    expect(bodyText).toContain("> bad");
    expect(bodyText).toContain("ERROR");
    expect(bodyText).toContain("> ");
  });

  it("applies the configured color and emits geometry", () => {
    const onGeometryChange = vi.fn();
    const { container } = render(
      <RetroLcd
        mode="value"
        value="grid"
        color="#66ff88"
        onGeometryChange={onGeometryChange}
      />
    );

    const root = container.querySelector(".retro-lcd");
    expect(root?.style.getPropertyValue("--retro-lcd-color")).toBe("#66ff88");
    expect(root).toHaveAttribute("data-rows");
    expect(root).toHaveAttribute("data-cols");
    expect(onGeometryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.any(Number),
        cols: expect.any(Number)
      })
    );
  });

  it("switches the base palette when a phosphor display color mode is selected", () => {
    const { container } = render(<RetroLcd mode="value" value="grid" displayColorMode="phosphor-amber" />);

    const root = container.querySelector(".retro-lcd");
    expect(root?.style.getPropertyValue("--retro-lcd-color")).toBe("#ffc96b");
    expect(root).toHaveAttribute("data-display-color-mode", "phosphor-amber");
  });

  it("shows a solid cursor for focused editable value mode", () => {
    const { container } = render(
      <RetroLcd mode="value" value="draft" editable autoFocus cursorMode="solid" />
    );

    expect(container.querySelector(".retro-lcd__cursor")).toHaveAttribute(
      "data-cursor-mode",
      "solid"
    );
  });

  it("renders placeholder dimming with the same color as faint ansi cells", () => {
    const placeholderView = render(
      <RetroLcd mode="value" value="" placeholder="What are you thinking about?" />
    );

    const placeholderLine = placeholderView.container.querySelector(
      ".retro-lcd__line"
    ) as HTMLElement | null;
    expect(placeholderLine).not.toBeNull();
    const placeholderColor = window.getComputedStyle(placeholderLine!).color;

    placeholderView.unmount();

    const controller = createRetroLcdController({ rows: 2, cols: 24 });
    const faintView = render(<RetroLcd mode="terminal" controller={controller} />);

    act(() => {
      controller.write("\u001b[2mOK\u001b[0m");
    });

    const faintCell = faintView.container.querySelector(".retro-lcd__cell--faint") as
      | HTMLElement
      | null;
    expect(faintCell).not.toBeNull();

    expect(window.getComputedStyle(faintCell!).color).toBe(placeholderColor);
  });

  it("updates the rendered cursor mode when the controller changes it", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 12, cursorMode: "solid" });
    const view = render(<RetroLcd mode="terminal" controller={controller} />);

    act(() => {
      controller.write("status");
    });

    const cursor = view.container.querySelector(".retro-lcd__cursor") as HTMLElement | null;
    expect(cursor).not.toBeNull();
    expect(cursor).toHaveAttribute("data-cursor-mode", "solid");

    act(() => {
      controller.setCursorMode("hollow");
    });

    expect(cursor).toHaveAttribute("data-cursor-mode", "hollow");
  });

  it("allows shift-enter line breaks in editable value mode without submitting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const Harness = () => {
      const [value, setValue] = useState("");

      return (
        <RetroLcd
          mode="value"
          value={value}
          editable
          autoFocus
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
          onSubmit={onSubmit}
        />
      );
    };
    const { container } = render(<Harness />);

    const input = container.querySelector(".retro-lcd__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();

    await user.type(input!, "first line{Shift>}{Enter}{/Shift}second line");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("first line\n");
    expect(onChange).toHaveBeenCalledWith("first line\nsecond line");
  });

  it("emits focus changes for editable value mode", async () => {
    const user = userEvent.setup();
    const onFocusChange = vi.fn();
    render(
      <>
        <RetroLcd mode="value" value="" editable onFocusChange={onFocusChange} />
        <button type="button">outside</button>
      </>
    );

    await user.click(screen.getByLabelText("Retro LCD input"));
    await user.click(screen.getByRole("button", { name: "outside" }));

    expect(onFocusChange).toHaveBeenNthCalledWith(1, true);
    expect(onFocusChange).toHaveBeenNthCalledWith(2, false);
  });

  it("keeps the cursor at the end when editable text is appended externally", () => {
    const appendedValue = "Compose inline.\nPress Enter when the thought lands.";
    const { container, rerender } = render(
      <RetroLcd mode="value" value="Compose inline." editable autoFocus />
    );

    const input = container.querySelector(".retro-lcd__input") as HTMLTextAreaElement | null;
    expect(input).not.toBeNull();

    act(() => {
      input!.focus();
      input!.setSelectionRange(input!.value.length, input!.value.length);
    });

    rerender(<RetroLcd mode="value" value={appendedValue} editable autoFocus />);

    const root = container.querySelector(".retro-lcd") as HTMLElement | null;
    const cursor = container.querySelector(".retro-lcd__cursor") as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(cursor).not.toBeNull();
    expect(input!.selectionStart).toBe(appendedValue.length);

    const cols = Number(root!.getAttribute("data-cols"));
    const wrappedLines = wrapTextToColumns(appendedValue, { cols });
    const expectedRow = wrappedLines.length - 1;
    const expectedCol = wrappedLines[expectedRow]?.length ?? 0;

    expect(cursor!.style.getPropertyValue("--retro-lcd-cursor-row")).toBe(String(expectedRow));
    expect(cursor!.style.getPropertyValue("--retro-lcd-cursor-col")).toBe(String(expectedCol));
  });
});
