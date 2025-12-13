import { describe, test, expect, beforeEach, vi } from "vitest";
import { ToolRegistry } from "./toolRegistry";
import { ToolDefinition } from "./llmService";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  test("should register tools from a server", () => {
    const tools: ToolDefinition[] = [
      {
        name: "test_tool",
        description: "A test tool",
        parameters: {
          type: "object",
          properties: {
            param1: { type: "string" },
          },
          required: ["param1"],
        },
      },
    ];

    registry.registerTools("test-server", tools);

    expect(registry.hasTool("test_tool")).toBe(true);
    expect(registry.getToolServer("test_tool")).toBe("test-server");
    expect(registry.getAllTools()).toHaveLength(1);
  });

  test("should unregister tools when server stops", () => {
    const tools: ToolDefinition[] = [
      {
        name: "test_tool",
        description: "A test tool",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    registry.registerTools("test-server", tools);
    expect(registry.hasTool("test_tool")).toBe(true);

    registry.unregisterTools("test-server");
    expect(registry.hasTool("test_tool")).toBe(false);
    expect(registry.getAllTools()).toHaveLength(0);
  });

  test("should notify listeners when tools change", () => {
    const listener = vi.fn();
    registry.subscribe(listener);

    const tools: ToolDefinition[] = [
      {
        name: "test_tool",
        description: "A test tool",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    registry.registerTools("test-server", tools);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(tools);
  });

  test("should handle multiple servers", () => {
    const tools1: ToolDefinition[] = [
      {
        name: "tool1",
        description: "Tool 1",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    const tools2: ToolDefinition[] = [
      {
        name: "tool2",
        description: "Tool 2",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    registry.registerTools("server1", tools1);
    registry.registerTools("server2", tools2);

    expect(registry.getAllTools()).toHaveLength(2);
    expect(registry.getToolServer("tool1")).toBe("server1");
    expect(registry.getToolServer("tool2")).toBe("server2");
  });

  test("should replace tools when server re-registers", () => {
    const tools1: ToolDefinition[] = [
      {
        name: "tool1",
        description: "Tool 1",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    const tools2: ToolDefinition[] = [
      {
        name: "tool1",
        description: "Tool 1 Updated",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "tool2",
        description: "Tool 2",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    registry.registerTools("server1", tools1);
    expect(registry.getAllTools()).toHaveLength(1);

    registry.registerTools("server1", tools2);
    expect(registry.getAllTools()).toHaveLength(2);
    const tool1 = registry.getAllTools().find(t => t.name === "tool1");
    expect(tool1?.description).toBe("Tool 1 Updated");
  });

  test("should get tools by server", () => {
    const tools1: ToolDefinition[] = [
      {
        name: "tool1",
        description: "Tool 1",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    const tools2: ToolDefinition[] = [
      {
        name: "tool2",
        description: "Tool 2",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    registry.registerTools("server1", tools1);
    registry.registerTools("server2", tools2);

    expect(registry.getToolsByServer("server1")).toHaveLength(1);
    expect(registry.getToolsByServer("server1")[0].name).toBe("tool1");
    expect(registry.getToolsByServer("server2")).toHaveLength(1);
    expect(registry.getToolsByServer("server2")[0].name).toBe("tool2");
  });
});
