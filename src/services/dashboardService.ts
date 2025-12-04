import { DashboardQuery, DashboardResult } from "../types/dashboard";

export class DashboardService {
  /**
   * Parse a natural language question into a structured query
   */
  async parseQuestion(
    question: string,
    workbooks: any[],
  ): Promise<Partial<DashboardQuery>> {
    // Use LLM to understand the question and extract query parameters
    const workbookNames = workbooks
      .filter((w) => !w.archived)
      .map((w) => w.name)
      .join(", ");

    const systemPrompt = `You are a dashboard query parser. Analyze the user's question and extract query parameters.

Available workbooks: ${workbookNames || "none"}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "queryType": "count|filter|date_range|aggregate|custom",
  "workbookName": "exact workbook name if mentioned, or null",
  "filters": {
    "documentType": "pdf|docx|txt|md|etc or null",
    "days": number (for date ranges like "90 days"),
    "keywords": ["keyword1"] or null
  },
  "metric": "what to count/measure"
}

Examples:
- "How many NDAs do we have?" → {"queryType":"count","workbookName":"NDA","filters":{}}
- "How many NDAs expiring in 90 days?" → {"queryType":"date_range","workbookName":"NDA","filters":{"days":90}}
- "List all PDFs in Contracts" → {"queryType":"filter","workbookName":"Contracts","filters":{"documentType":"pdf"}}`;

    try {
      const response = await window.electronAPI.llm.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: `Parse this question: "${question}"` },
      ]);

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response;
      const codeBlockMatch = response.match(
        /```(?:json)?\s*(\{[\s\S]*\})\s*```/,
      );
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      } else {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      const parsed = JSON.parse(jsonStr);

      // Convert workbook name to ID
      if (parsed.workbookName) {
        const workbook = workbooks.find((w) =>
          w.name.toLowerCase().includes(parsed.workbookName.toLowerCase()),
        );
        if (workbook) {
          parsed.workbookId = workbook.id;
        }
      }

      return parsed;
    } catch (error) {
      console.error(
        "Failed to parse question with LLM, using simple parser:",
        error,
      );
    }

    // Fallback: simple parsing
    return this.simpleParse(question, workbooks);
  }

  private simpleParse(
    question: string,
    workbooks: any[],
  ): Partial<DashboardQuery> {
    const lowerQuestion = question.toLowerCase();

    // Detect query type
    let queryType: DashboardQuery["queryType"] = "count";
    if (
      lowerQuestion.includes("expiring") ||
      lowerQuestion.includes("expire") ||
      lowerQuestion.includes("expir")
    ) {
      queryType = "date_range";
    } else if (
      lowerQuestion.includes("list") ||
      lowerQuestion.includes("show") ||
      lowerQuestion.includes("what")
    ) {
      queryType = "filter";
    }

    // Extract workbook ID
    let workbookId: string | undefined;
    for (const wb of workbooks.filter((w) => !w.archived)) {
      if (lowerQuestion.includes(wb.name.toLowerCase())) {
        workbookId = wb.id;
        break;
      }
    }

    // Extract date range
    const dateRangeMatch = lowerQuestion.match(/(\d+)\s*days?/);
    const days = dateRangeMatch ? parseInt(dateRangeMatch[1]) : undefined;

    // Extract document type
    let documentType: string | undefined;
    if (lowerQuestion.includes("pdf")) documentType = "pdf";
    else if (lowerQuestion.includes("docx") || lowerQuestion.includes("word"))
      documentType = "docx";
    else if (lowerQuestion.includes("markdown") || lowerQuestion.includes("md"))
      documentType = "md";

    return {
      queryType,
      workbookId,
      filters: {
        ...(days && { days }),
        ...(documentType && { documentType }),
      },
    };
  }

  /**
   * Execute a dashboard query and return results
   * Now uses the MCP Dashboard Server for dynamic code generation
   */
  async executeQuery(
    query: DashboardQuery,
    workbooks: any[],
  ): Promise<DashboardResult> {
    // Try to use MCP Dashboard Server if available
    if (window.electronAPI?.mcp?.dashboardQuery) {
      try {
        const response = await window.electronAPI.mcp.dashboardQuery(
          query.question,
          query.workbookId
        );

        // Check if MCP call was successful
        if (response && response.success && response.result) {
          // Store the generated code in the query (caller will save it)
          if (response.generatedCode && query.id) {
            // We can't modify query here, but caller will handle it
            console.log("Generated code:", response.generatedCode.substring(0, 100) + "...");
          }

          return response.result;
        } else if (response && response.error) {
          console.error("MCP Dashboard error:", response.error);
          return {
            type: "error",
            error: response.error
          };
        }
      } catch (error) {
        console.error("Failed to call MCP Dashboard Server, falling back to legacy:", error);
        // Fall through to legacy implementation
      }
    }

    // Legacy implementation (fallback)
    const targetWorkbook = query.workbookId
      ? workbooks.find((w) => w.id === query.workbookId)
      : workbooks.find((w) => !w.archived);

    if (!targetWorkbook) {
      return { value: 0, data: [], chartType: "card" };
    }

    switch (query.queryType) {
      case "count":
        return this.executeCountQuery(query, targetWorkbook);

      case "date_range":
        return await this.executeDateRangeQuery(query, targetWorkbook);

      case "filter":
        return this.executeFilterQuery(query, targetWorkbook);

      default:
        return { value: 0, data: [], chartType: "card" };
    }
  }

  private executeCountQuery(
    query: DashboardQuery,
    workbook: any,
  ): DashboardResult {
    let documents = workbook.documents.filter((d: any) => !d.archived);

    // Apply filters
    if (query.filters?.documentType) {
      const ext = query.filters.documentType;
      documents = documents.filter((d: any) =>
        d.filename.toLowerCase().endsWith(`.${ext}`),
      );
    }

    if (query.filters?.keywords) {
      const keywords = query.filters.keywords as string[];
      documents = documents.filter((d: any) =>
        keywords.some((kw) =>
          d.filename.toLowerCase().includes(kw.toLowerCase()),
        ),
      );
    }

    return {
      value: documents.length,
      data: documents.map((d: any) => ({
        filename: d.filename,
        addedAt: d.addedAt,
      })),
      chartType: "card",
      metadata: {
        workbookName: workbook.name,
        totalDocuments: documents.length,
      },
    };
  }

  private async executeDateRangeQuery(
    query: DashboardQuery,
    workbook: any,
  ): Promise<DashboardResult> {
    const days = query.filters?.days || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    // Try to extract expiration dates from documents
    // For now, we'll use a heuristic: look for dates in filenames or use addedAt + 1 year
    const documents = workbook.documents
      .filter((d: any) => !d.archived)
      .map((d: any) => {
        // Try to extract date from filename (e.g., "NDA_2024-12-31.pdf")
        const dateMatch = d.filename.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
        let expiresDate: Date;

        if (dateMatch) {
          expiresDate = new Date(dateMatch[1]);
        } else {
          // Default: assume 1 year from when document was added
          const addedDate = new Date(d.addedAt);
          expiresDate = new Date(addedDate);
          expiresDate.setFullYear(expiresDate.getFullYear() + 1);
        }

        const daysUntilExpiry = Math.ceil(
          (expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        return {
          ...d,
          expiresDate: expiresDate.toISOString(),
          daysUntilExpiry,
        };
      })
      .filter((d: any) => {
        const expiresDate = new Date(d.expiresDate);
        return expiresDate <= cutoffDate && expiresDate >= new Date();
      })
      .sort((a: any, b: any) => a.daysUntilExpiry - b.daysUntilExpiry);

    return {
      value: documents.length,
      data: documents.map((d: any) => ({
        filename: d.filename,
        expiresDate: d.expiresDate,
        daysUntilExpiry: d.daysUntilExpiry,
        addedAt: d.addedAt,
      })),
      chartType: "table",
      metadata: {
        workbookName: workbook.name,
        days,
        expiringCount: documents.length,
      },
    };
  }

  private executeFilterQuery(
    query: DashboardQuery,
    workbook: any,
  ): DashboardResult {
    let documents = workbook.documents.filter((d: any) => !d.archived);

    // Apply filters
    if (query.filters?.documentType) {
      const ext = query.filters.documentType;
      documents = documents.filter((d: any) =>
        d.filename.toLowerCase().endsWith(`.${ext}`),
      );
    }

    if (query.filters?.keywords) {
      const keywords = query.filters.keywords as string[];
      documents = documents.filter((d: any) =>
        keywords.some((kw) =>
          d.filename.toLowerCase().includes(kw.toLowerCase()),
        ),
      );
    }

    return {
      data: documents.map((d: any) => ({
        filename: d.filename,
        addedAt: d.addedAt,
        path: d.path,
      })),
      chartType: "table",
      metadata: {
        workbookName: workbook.name,
        count: documents.length,
      },
    };
  }
}

export const dashboardService = new DashboardService();
