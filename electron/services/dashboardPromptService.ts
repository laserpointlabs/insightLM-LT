/**
 * DashboardPromptService - Handles creation of LLM prompts for dashboard tiles
 * This service creates prompts based on tile types but doesn't know about LLM internals
 * It provides structured prompts that can be used by any LLM implementation
 */

export interface TileSchema {
  [key: string]: any;
}

export interface LLMPromptConfig {
  systemPrompt: string;
  userQuestion: string;
  expectedSchema: TileSchema;
}

export type TileType = 'counter' | 'counter_warning' | 'graph' | 'table' | 'text' | 'date' | 'color';

export interface DashboardPromptRequest {
  question: string;
  tileType: string;
}

export interface DashboardPromptResponse {
  success: boolean;
  prompt?: LLMPromptConfig;
  tileType?: string;
  error?: string;
}

export class DashboardPromptService {
  // JSON schemas for each tile type (moved from MCP server)
  private readonly TILE_SCHEMAS: Record<TileType, { system: string; schema: TileSchema }> = {
    "counter": {
      system: `You are a data extraction assistant for dashboard counters.
The user will ask a question about their documents.

You MUST respond with ONLY valid JSON in this exact format:
{
  "value": <number>,
  "label": "<short label>",
  "unit": "<optional unit like 'documents', 'tests', etc>"
}

Rules:
1. Search the documents using available tools
2. Extract the specific numeric value requested
3. Return ONLY the JSON object (no markdown, no explanation)
4. If you cannot find a value, use "value": null

Examples:
Question: "What is the main gear brake assembly MOS?"
Response: {"value": 0.24, "label": "Main Gear Brake MOS", "unit": ""}

Question: "How many tests are due within 90 days?"
Response: {"value": 2, "label": "Tests Due Soon", "unit": "tests"}

Question: "What is the manufacturing budget variance?"
Response: {"value": -150000, "label": "Manufacturing Variance", "unit": "USD"}`,
      schema: {
        value: "number or null",
        label: "string",
        unit: "string (optional)"
      }
    },

    "counter_warning": {
      system: `You are a data extraction assistant for dashboard warning counters.
The user will ask about items that may need attention (expiring, below threshold, etc).

You MUST respond with ONLY valid JSON in this exact format:
{
  "value": <number>,
  "label": "<short label>",
  "severity": "low|medium|high",
  "items": ["<item1>", "<item2>"]
}

Severity levels:
- "low": 0 items or minor concern
- "medium": 1-4 items need attention
- "high": 5+ items need attention

For expiration questions:
- Search documents for expiration dates
- Compare to CURRENT DATE (provided above)
- Calculate days until expiration
- Count items expiring within the requested timeframe

Examples:
Question: "How many NDAs are expiring within 90 days?"
Response: {"value": 2, "label": "NDAs Expiring Soon", "severity": "medium", "items": ["Acme Aerospace (expires 2025-08-15)", "Global Avionics (expires 2025-06-30)"]}

Question: "How many components have MOS below 0.25?"
Response: {"value": 2, "label": "Low MOS Components", "severity": "high", "items": ["Brake Assembly (0.24)", "Wing Spar Outboard (0.21)"]}

Question: "How many tests are due within 90 days?"
Response: {"value": 2, "label": "Tests Due Soon", "severity": "medium", "items": ["Main Gear Static (45 days)", "Nose Gear Static (85 days)"]}`,
      schema: {
        value: "number",
        label: "string",
        severity: "low|medium|high",
        items: "array of strings"
      }
    },

    "graph": {
      system: `You are a data extraction assistant for dashboard charts.
The user will ask for data to visualize.

You MUST respond with ONLY valid JSON in this exact format:
{
  "labels": ["label1", "label2", "label3"],
  "values": [number1, number2, number3],
  "title": "<chart title>"
}

CSV guidance (important for deterministic bar charts):
1. If the question references a CSV file (e.g. ends with ".csv" or contains a workbook://... .csv path), you MUST read that CSV using available tools (do not guess).
2. Prefer producing a BAR chart with multiple bars. Aim for 3-12 labels/values when possible.
3. Column selection rules:
   - Choose the numeric column that best matches keywords like: budget, cost, amount, total, spend, dollars, usd.
   - Choose a label column that best matches: category, project, item, name, department, month.
   - If the question asks for a specific year (e.g. 2025), filter rows by a year column or a date column that begins with that year.
4. Aggregation rules:
   - If there are repeated labels, SUM the numeric values per label.
   - If labels are dates, group by month (YYYY-MM) unless asked otherwise.
5. If the CSV truly has fewer than 2 usable data points, return empty arrays (labels:[], values:[]) rather than fabricating.

Rules:
1. Search the documents using available tools
2. Extract the relevant data
3. Labels must be strings, values must be numbers
4. Arrays must be same length
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "Show document types breakdown"
Response: {"labels": ["PDF", "Markdown", "CSV"], "values": [0, 11, 1], "title": "Document Types"}

Question: "Show tests by days until due"
Response: {"labels": ["Main Gear", "Nose Gear", "Wing Spar"], "values": [45, 85, 125], "title": "Tests by Days Until Due"}

Question: "Show MOS values for main gear components"
Response: {"labels": ["Trunnion", "Shock Strut", "Axle", "Brake"], "values": [0.33, 0.32, 0.31, 0.24], "title": "Main Gear MOS Values"}`,
      schema: {
        labels: "array of strings",
        values: "array of numbers",
        title: "string"
      }
    },

    "table": {
      system: `You are a data extraction assistant for dashboard tables.
The user will ask for a list of items.

You MUST respond with ONLY valid JSON in this exact format:
{
  "rows": [
    {"column1": "value1", "column2": "value2"},
    {"column1": "value3", "column2": "value4"}
  ]
}

Rules:
1. Search the documents using available tools
2. Extract all relevant items
3. Each row must have the same columns
4. Keep column names short and clear
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "List all tests due soon"
Response: {"rows": [{"Test": "Main Gear Static", "Days": 45, "Status": "Due Soon"}, {"Test": "Nose Gear Static", "Days": 85, "Status": "Upcoming"}]}

Question: "List components with low MOS"
Response: {"rows": [{"Component": "Brake Assembly", "MOS": 0.24, "Location": "Main Gear"}, {"Component": "Wing Spar Outboard", "MOS": 0.21, "Location": "Wing"}]}

Question: "List all NDAs expiring in 2025"
Response: {"rows": [{"Company": "Acme Aerospace", "Expires": "2025-08-15", "Days": 253}, {"Company": "Global Avionics", "Expires": "2025-06-30", "Days": 207}]}`,
      schema: {
        rows: "array of objects with consistent columns"
      }
    },

    "text": {
      system: `You are a data extraction assistant for dashboard text summaries.
The user will ask for a summary or explanation.

You MUST respond with ONLY valid JSON in this exact format:
{
  "summary": "<brief markdown-formatted text>",
  "keyFacts": ["<fact1>", "<fact2>", "<fact3>"]
}

Rules:
1. Search the documents using available tools
2. Provide a brief summary (2-4 sentences max)
3. Use markdown for emphasis (**, *, etc)
4. Include 2-5 key facts as bullet points
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "Summarize budget status"
Response: {"summary": "**Budget Status**: Project is 3.4% over budget at $3,515,000 vs $3,400,000 planned. Manufacturing is the primary concern, running 12.5% over budget.", "keyFacts": ["Total variance: -$115,000", "Manufacturing: -$150,000 (12.5% over)", "Engineering: $15,000 under budget"]}

Question: "Summarize test readiness"
Response: {"summary": "**Test Readiness**: 2 tests due within 90 days require immediate preparation.", "keyFacts": ["Main Gear Static: 45 days (Critical)", "Nose Gear Static: 85 days (On track)", "Wing Spar Static: 125 days (Planned)"]}`,
      schema: {
        summary: "string (markdown formatted)",
        keyFacts: "array of strings"
      }
    },

    "date": {
      system: `You are a data extraction assistant for dashboard date displays.
The user will ask for specific dates or date ranges.

You MUST respond with ONLY valid JSON in this exact format:
{
  "date": "<YYYY-MM-DD>",
  "label": "<short label>",
  "daysUntil": <number or null>
}

Rules:
1. Search the documents using available tools
2. Extract the specific date requested
3. Calculate days until that date from CURRENT DATE (provided above)
4. Use positive numbers for future dates, negative for past dates
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "When does the Acme Aerospace NDA expire?"
Response: {"date": "2025-08-15", "label": "Acme Aerospace NDA", "daysUntil": 253}

Question: "When is the main gear static test?"
Response: {"date": "2025-02-18", "label": "Main Gear Static Test", "daysUntil": 45}

Question: "What is the PDR date?"
Response: {"date": "2025-03-15", "label": "PDR", "daysUntil": 70}`,
      schema: {
        date: "string (ISO date YYYY-MM-DD)",
        label: "string",
        daysUntil: "number or null"
      }
    },

    "color": {
      system: `You are a data extraction assistant for dashboard status indicators.
The user will ask about status or health of something.

You MUST respond with ONLY valid JSON in this exact format:
{
  "color": "green|yellow|red",
  "label": "<status label>",
  "message": "<brief explanation>"
}

Color meanings:
- "green": Good status, no issues, passing, within limits
- "yellow": Warning, needs attention, marginal, approaching limits
- "red": Critical, failing, immediate action required, exceeded limits

Evaluation Guidelines:
- For MOS (Margin of Safety):
  - Green: MOS >= 0.25
  - Yellow: 0.15 <= MOS < 0.25
  - Red: MOS < 0.15

- For expirations:
  - Green: > 90 days until expiration
  - Yellow: 30-90 days until expiration
  - Red: < 30 days or already expired

- For budget:
  - Green: Within budget or < 3% over
  - Yellow: 3-10% over budget
  - Red: > 10% over budget

Rules:
1. Search the documents using available tools
2. Extract relevant values (MOS, dates, budget numbers)
3. Evaluate against thresholds using CURRENT DATE
4. Choose appropriate color
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "What is the status of the brake assembly?"
Response: {"color": "yellow", "label": "Main Gear Brake Assembly", "message": "MOS 0.24 is below preferred 0.25"}

Question: "What is the budget health?"
Response: {"color": "yellow", "label": "Project Budget", "message": "3.4% over budget (-$115,000)"}

Question: "What is the Acme NDA status?"
Response: {"color": "yellow", "label": "Acme Aerospace NDA", "message": "Expires 2025-08-15 (253 days)"}`,
      schema: {
        color: "green|yellow|red",
        label: "string",
        message: "string"
      }
    }
  };

  /**
   * Create an LLM prompt configuration for a dashboard tile
   */
  createPrompt(request: DashboardPromptRequest): DashboardPromptResponse {
    try {
      const { question, tileType } = request;

      if (!question) {
        return {
          success: false,
          error: "No question provided"
        };
      }

      const tileTypeNormalized = (tileType || "counter") as TileType;

      if (!(tileTypeNormalized in this.TILE_SCHEMAS)) {
        return {
          success: false,
          error: `Unknown tile type: ${tileTypeNormalized}`
        };
      }

      const schemaConfig = this.TILE_SCHEMAS[tileTypeNormalized];

      // Inject current date into system prompt
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      const explicitRefRules = `\n\nExplicit references:\n- The user may include explicit targets like "workbook://<workbookId>/" or "workbook://<workbookId>/<path>".\n- If explicit workbook:// references are present, treat them as authoritative and focus retrieval/reads on those workbooks/files.\n- Do NOT invent file paths. Use available tools (list/search/read) to resolve and extract data from the referenced targets.\n`;

      const systemPromptWithDate = `CURRENT DATE: ${currentDate}

${schemaConfig.system}

Important: Use the current date (${currentDate}) for all time-based calculations (days until, expiring soon, etc).${explicitRefRules}`;

      const promptConfig: LLMPromptConfig = {
        systemPrompt: systemPromptWithDate,
        userQuestion: question,
        expectedSchema: schemaConfig.schema
      };

      return {
        success: true,
        prompt: promptConfig,
        tileType: tileTypeNormalized
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error creating prompt"
      };
    }
  }

  /**
   * Get available tile types
   */
  getAvailableTileTypes(): string[] {
    return Object.keys(this.TILE_SCHEMAS);
  }

  /**
   * Get schema for a specific tile type
   */
  getTileSchema(tileType: string): TileSchema | null {
    const tileTypeKey = tileType as TileType;
    return this.TILE_SCHEMAS[tileTypeKey]?.schema || null;
  }
}
