import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendHorizontal } from "lucide-react";
import { describe, expect, test, vi } from "vitest";

import { NaturalLanguageDialog } from "./NaturalLanguageDialog.jsx";

describe("NaturalLanguageDialog", () => {
  test("submits the current natural-language text from the send button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <NaturalLanguageDialog
        ariaLabel="自然语言输入区"
        inputLabel="自然语言问题"
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder="描述你的问题"
        submitAriaLabel="发送自然语言问题"
        submitIcon={<SendHorizontal aria-hidden="true" size={18} />}
        value="检查节点健康"
      />,
    );

    await user.click(screen.getByRole("button", { name: "发送自然语言问题" }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  test("submits with Enter but keeps Shift Enter for line breaks", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <NaturalLanguageDialog
        ariaLabel="自然语言输入区"
        inputLabel="自然语言问题"
        onChange={() => {}}
        onSubmit={onSubmit}
        placeholder="描述你的问题"
        submitAriaLabel="发送自然语言问题"
        value="检查节点健康"
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "自然语言问题" }), "{shift>}{enter}{/shift}");
    expect(onSubmit).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  test("disables textarea and submit button when the dialog is disabled", () => {
    render(
      <NaturalLanguageDialog
        ariaLabel="自然语言输入区"
        disabled
        inputLabel="自然语言问题"
        onChange={() => {}}
        onSubmit={() => {}}
        placeholder="描述你的问题"
        submitAriaLabel="发送自然语言问题"
        value=""
      />,
    );

    expect(screen.getByRole("textbox", { name: "自然语言问题" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "发送自然语言问题" })).toBeDisabled();
  });
});
