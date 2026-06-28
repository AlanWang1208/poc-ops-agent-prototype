import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { SearchBox } from "./SearchBox.jsx";

const searchBoxCss = readFileSync(
  "src/components/search/SearchBox.module.css",
  "utf8",
);

describe("SearchBox", () => {
  test("lays out mode tabs above a single active search panel", () => {
    const searchBoxRule =
      searchBoxCss.match(/[.]searchBox\s*[{][^}]+[}]/u)?.[0] ?? "";
    const tabListRule =
      searchBoxCss.match(/[.]tabList\s*[{][^}]+[}]/u)?.[0] ?? "";
    const conditionPanelRule =
      searchBoxCss.match(/[.]conditionPanel\s*[{][^}]+[}]/u)?.[0] ?? "";
    const naturalPanelRule =
      searchBoxCss.match(/[.]naturalPanel\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(searchBoxRule).toContain("grid-template-columns: 1fr");
    expect(tabListRule).toContain("grid-column: 1 / -1");
    expect(conditionPanelRule).toContain("grid-column: 1 / -1");
    expect(naturalPanelRule).toContain("grid-column: 1 / -1");
  });

  test("renders a leading icon for each search mode tab", () => {
    render(
      <SearchBox
        ariaLabel="Skill search"
        modes={[
          { label: "Conditions", value: "conditions" },
          { label: "Natural language", value: "natural" },
        ]}
        onSearch={() => {}}
        placeholder="Skill ID / description / owner"
      />,
    );

    expect(
      screen.getByRole("tab", { name: "Conditions" }).querySelector("svg[aria-hidden='true']"),
    ).not.toBeNull();
    expect(
      screen.getByRole("tab", { name: "Natural language" }).querySelector("svg[aria-hidden='true']"),
    ).not.toBeNull();
  });

  test("submits a traditional condition search", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(
      <SearchBox
        ariaLabel="Skill 搜索"
        onSearch={onSearch}
        placeholder="Skill ID / 描述 / Owner"
      />,
    );

    await user.type(screen.getByRole("searchbox", { name: "搜索关键字" }), "node");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    expect(onSearch).toHaveBeenCalledWith({ mode: "conditions", query: "node" });
  });

  test("renders condition filters inside the conditions tab panel", async () => {
    const user = userEvent.setup();
    const onConditionChange = vi.fn();

    render(
      <SearchBox
        ariaLabel="Skill 搜索"
        conditionLabel="条件过滤"
        conditionOptions={[
          { label: "全部", value: "ALL" },
          { label: "READ_ONLY", value: "READ_ONLY" },
        ]}
        onConditionChange={onConditionChange}
        onSearch={() => {}}
        placeholder="Skill ID / 描述 / Owner"
        selectedCondition="ALL"
      />,
    );

    const conditionPanel = screen.getByRole("tabpanel", { name: "条件" });
    expect(within(conditionPanel).getByRole("group", { name: "条件过滤" })).toBeInTheDocument();
    expect(within(conditionPanel).getByRole("button", { name: "全部" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(conditionPanel).getByRole("button", { name: "READ_ONLY" }));

    expect(onConditionChange).toHaveBeenCalledWith("READ_ONLY");
  });

  test("submits a natural-language search from the natural language tab", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(
      <SearchBox
        ariaLabel="Skill 搜索"
        modes={[
          { label: "条件", value: "conditions" },
          { label: "自然语言", value: "natural" },
        ]}
        onSearch={onSearch}
        placeholder="Skill ID / 描述 / Owner"
      />,
    );

    await user.click(screen.getByRole("tab", { name: "自然语言" }));
    await user.type(screen.getByRole("textbox", { name: "自然语言搜索" }), "查找节点健康 Skill");
    await user.keyboard("{Enter}");

    expect(onSearch).toHaveBeenCalledWith({
      mode: "natural",
      query: "查找节点健康 Skill",
    });
  });

  test("uses the Agent workspace composer treatment for natural-language search", async () => {
    const user = userEvent.setup();

    render(
      <SearchBox
        ariaLabel="Skill 搜索"
        onSearch={() => {}}
        placeholder="Skill ID / 描述 / Owner"
      />,
    );

    await user.click(screen.getByRole("tab", { name: "自然语言" }));

    const naturalSearch = screen.getByRole("search", { name: "Skill 搜索自然语言" });
    const naturalInput = screen.getByRole("textbox", { name: "自然语言搜索" });
    const naturalSubmit = screen.getByRole("button", { name: "搜索自然语言" });

    expect(naturalSearch.className).toContain("agentComposer");
    expect(naturalInput.className).toContain("agentComposerInput");
    expect(naturalSubmit.className).toContain("agentComposerSubmit");
  });

  test("clears the query and emits an empty search", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(
      <SearchBox
        ariaLabel="Skill 搜索"
        initialValue="node"
        onSearch={onSearch}
        placeholder="Skill ID / 描述 / Owner"
      />,
    );

    const searchRegion = screen.getByRole("search", { name: "Skill 搜索" });
    await user.click(within(searchRegion).getByRole("button", { name: "清空搜索" }));

    expect(screen.getByRole("searchbox", { name: "搜索关键字" })).toHaveValue("");
    expect(onSearch).toHaveBeenCalledWith({ mode: "conditions", query: "" });
  });
});
