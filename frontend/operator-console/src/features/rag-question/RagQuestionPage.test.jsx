import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";

import { AppProviders } from "../../app/providers.jsx";
import { RagQuestionPage } from "./RagQuestionPage.jsx";

describe("RagQuestionPage", () => {
  test("renders RAG input through the shared natural-language dialog", () => {
    render(
      <AppProviders Router={MemoryRouter} routerProps={{ initialEntries: ["/rag"] }}>
        <RagQuestionPage />
      </AppProviders>,
    );

    expect(screen.getByRole("search", { name: "RAG 问题输入区" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "RAG 问题" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提交 RAG 问题" })).toBeDisabled();
  });
});
