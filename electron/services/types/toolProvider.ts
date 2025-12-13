/**
 * Tool Provider Abstraction Layer
 *
 * Phase 3: Abstract MCP server communications to create a generic interface
 * for tool execution, enabling easy plugging-in of different tool providers.
 */

export enum ToolCapability {
  TEXT_PROCESSING = 'text_processing',
  DATA_ANALYSIS = 'data_analysis',
  FILE_OPERATIONS = 'file_operations',
  COMPUTATION = 'computation',
  EXTERNAL_API = 'external_api',
  CUSTOM = 'custom'
}

export enum ProviderHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export interface ToolExecutionContext {
  /** The name of the tool to execute */
  toolName: string;

  /** Parameters to pass to the tool */
  parameters: Record<string, any>;

  /** Optional timeout in milliseconds */
  timeout?: number;

  /** Optional metadata for execution context */
  metadata?: Record<string, any>;

  /** Optional request ID for tracking */
  requestId?: string;
}

export interface ToolExecutionResult {
  /** Whether the execution was successful */
  success: boolean;

  /** The result data if successful */
  result?: any;

  /** Alternative result format (for compatibility) */
  content?: any;

  /** Error information if execution failed */
  error?: ToolExecutionError;

  /** Execution metadata */
  metadata: ToolExecutionMetadata;
}

export interface ToolExecutionError {
  /** Error code */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Optional error details */
  details?: any;

  /** Whether this error is retryable */
  retryable: boolean;
}

export interface ToolExecutionMetadata {
  /** Name of the provider that executed the tool */
  provider: string;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Number of retry attempts made */
  retryCount: number;

  /** Timestamp of execution start */
  startTime: number;

  /** Timestamp of execution completion */
  endTime: number;

  /** Additional provider-specific metadata */
  providerMetadata?: Record<string, any>;
}

export interface ProviderHealthStatus {
  /** Current health state */
  status: ProviderHealth;

  /** Health check timestamp */
  lastChecked: number;

  /** Response time in milliseconds */
  responseTime?: number;

  /** Error message if unhealthy */
  errorMessage?: string;

  /** Additional health metrics */
  metrics?: Record<string, any>;
}

/**
 * Generic Tool Provider Interface
 *
 * This interface abstracts away the specifics of different tool execution
 * mechanisms (MCP servers, REST APIs, local functions, etc.) and provides
 * a unified way to execute tools.
 */
export interface IToolProvider {
  /** Unique name of this provider */
  readonly name: string;

  /** Capabilities this provider supports */
  readonly capabilities: ToolCapability[];

  /** Priority for this provider (higher = preferred) */
  readonly priority: number;

  /**
   * Initialize the provider
   * Called when the provider is registered or the system starts
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the provider
   * Called when the provider is unregistered or the system shuts down
   */
  shutdown(): Promise<void>;

  /**
   * Check if this provider can execute the given tool
   */
  canExecute(toolName: string): boolean;

  /**
   * Execute a tool with the given context
   */
  executeTool(context: ToolExecutionContext): Promise<ToolExecutionResult>;

  /**
   * Get the current health status of this provider
   */
  getHealth(): Promise<ProviderHealthStatus>;

  /**
   * Get all tools provided by this provider
   * Used for tool discovery and registration
   */
  getAvailableTools(): Promise<ToolDefinition[]>;

  /**
   * Optional: Handle provider-specific configuration updates
   */
  updateConfiguration?(config: Record<string, any>): Promise<void>;
}

/**
 * Tool definition as understood by the LLM
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Input schema for parameters */
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };

  /** Provider that provides this tool */
  provider: string;

  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Provider registration options
 */
export interface ProviderRegistrationOptions {
  /** Provider instance */
  provider: IToolProvider;

  /** Whether to auto-initialize on registration */
  autoInitialize?: boolean;

  /** Configuration for this provider */
  config?: Record<string, any>;
}

/**
 * Provider execution options
 */
export interface ProviderExecutionOptions {
  /** Preferred provider name (optional) */
  preferredProvider?: string;

  /** Fallback providers to try if preferred fails */
  fallbackProviders?: string[];

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Timeout per execution attempt */
  timeout?: number;
}
