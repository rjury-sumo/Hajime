# AI Log Analysis Integration Design - MVP

## Overview

This document describes the integration of local AI analysis capabilities into the existing Sumo Logic VS Code extension. The MVP adds AI-powered log analysis using Ollama (local LLM) while maintaining the existing Sumo Logic search functionality.

## Current State

- ✅ VS Code extension with Sumo Logic search job API integration
- ✅ Polls search jobs and returns JSON results
- ✅ Supports raw logs and aggregate queries

## What We're Adding

- 🆕 Local AI analysis via Ollama
- 🆕 AI provider interface (extensible for future providers)
- 🆕 Log analysis commands and UI
- 🆕 Configuration for AI settings

---

## Architecture

```
Existing Extension
├── Sumo Logic API Client ✅
│   ├── Search job submission
│   ├── Job polling
│   └── Result retrieval
│
└── NEW: AI Analysis Layer 🆕
    ├── AI Provider Interface
    │   └── Ollama Provider (MVP)
    ├── Log Analysis Orchestrator
    ├── Prompt Templates
    └── Result Formatter
```

---

## Key Components to Implement

### 1. AI Provider Interface

**File**: `src/ai/providers/IAIProvider.ts`

```typescript
export interface LogEntry {
  timestamp: string;
  message: string;
  severity?: string;
  [key: string]: any;
}

export interface LogAnalysisRequest {
  logs: LogEntry[];
  query: string;
  analysisType: 'observability' | 'security' | 'general';
  maxTokens?: number;
}

export interface LogAnalysisResponse {
  summary: string;
  keyFindings: string[];
  anomalies: string[];
  recommendations: string[];
  rawResponse: string;
}

export interface AIProviderConfig {
  baseUrl: string;
  model: string;
  contextSize: number;
  temperature: number;
}

export interface IAIProvider {
  readonly name: string;
  readonly isLocal: boolean;
  
  initialize(config: AIProviderConfig): Promise<void>;
  analyzeLog(request: LogAnalysisRequest): Promise<LogAnalysisResponse>;
  healthCheck(): Promise<boolean>;
  listAvailableModels(): Promise<string[]>;
}
```

### 2. Ollama Provider Implementation

**File**: `src/ai/providers/OllamaProvider.ts`

```typescript
export class OllamaProvider implements IAIProvider {
  readonly name = 'ollama';
  readonly isLocal = true;
  
  private config: AIProviderConfig;
  
  async initialize(config: AIProviderConfig): Promise<void> {
    this.config = config;
    const healthy = await this.healthCheck();
    if (!healthy) {
      throw new Error('Ollama is not running. Please start Ollama.');
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET'
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async listAvailableModels(): Promise<string[]> {
    const response = await fetch(`${this.config.baseUrl}/api/tags`);
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  }
  
  async analyzeLog(request: LogAnalysisRequest): Promise<LogAnalysisResponse> {
    const prompt = this.buildPrompt(request);
    
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_ctx: this.config.contextSize
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    return this.parseResponse(result.response, request.query);
  }
  
  private buildPrompt(request: LogAnalysisRequest): string {
    const template = PromptTemplates[request.analysisType];
    const formattedLogs = this.formatLogs(request.logs);
    
    return template
      .replace('{{QUERY}}', request.query)
      .replace('{{LOG_COUNT}}', request.logs.length.toString())
      .replace('{{LOGS}}', formattedLogs);
  }
  
  private formatLogs(logs: LogEntry[]): string {
    return logs
      .slice(0, 100) // Limit for context window
      .map((log, idx) => `[${idx + 1}] ${log.timestamp} [${log.severity || 'INFO'}] ${log.message}`)
      .join('\n');
  }
  
  private parseResponse(rawResponse: string, query: string): LogAnalysisResponse {
    // Parse structured response from LLM
    // This is a simple parser - enhance based on actual LLM output format
    
    return {
      summary: this.extractSection(rawResponse, 'Summary:') || rawResponse.slice(0, 200),
      keyFindings: this.extractListSection(rawResponse, 'Key Findings:'),
      anomalies: this.extractListSection(rawResponse, 'Anomalies:'),
      recommendations: this.extractListSection(rawResponse, 'Recommendations:'),
      rawResponse: rawResponse
    };
  }
  
  private extractSection(text: string, header: string): string | null {
    const regex = new RegExp(`${header}\\s*([^\\n]+(?:\\n(?!\\w+:)[^\\n]+)*)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }
  
  private extractListSection(text: string, header: string): string[] {
    const section = this.extractSection(text, header);
    if (!section) return [];
    
    return section
      .split('\n')
      .map(line => line.replace(/^[-*•]\s*/, '').trim())
      .filter(line => line.length > 0);
  }
}
```

### 3. Prompt Templates

**File**: `src/ai/PromptTemplates.ts`

```typescript
export const PromptTemplates = {
  observability: `You are an expert in log analysis for observability and system monitoring.

User Query: {{QUERY}}

Analyze these {{LOG_COUNT}} log entries:

{{LOGS}}

Provide a structured analysis with:

Summary:
[2-3 sentence overview of what's happening in these logs]

Key Findings:
- [Most important patterns or issues]
- [Performance insights]
- [Error patterns]

Anomalies:
- [Unusual patterns or outliers]
- [Unexpected behaviors]

Recommendations:
- [Actionable next steps]
- [What to investigate further]

Keep your response concise and actionable.`,

  security: `You are a security analyst investigating potential security incidents and threats.

User Query: {{QUERY}}

Analyze these {{LOG_COUNT}} log entries for security concerns:

{{LOGS}}

Provide a structured security analysis:

Summary:
[2-3 sentence security assessment]

Key Findings:
- [Security-relevant patterns]
- [Indicators of Compromise (IOCs)]
- [Authentication/authorization issues]

Anomalies:
- [Suspicious activities]
- [Unusual access patterns]
- [Potential security events]

Recommendations:
- [Immediate actions needed]
- [Further investigation steps]
- [Security hardening suggestions]

Focus on actionable security insights.`,

  general: `You are a log analysis expert helping investigate system behavior.

User Query: {{QUERY}}

Analyze these {{LOG_COUNT}} log entries:

{{LOGS}}

Provide:

Summary:
[Brief overview]

Key Findings:
- [Main patterns and insights]

Anomalies:
- [Anything unusual]

Recommendations:
- [What to do next]

Be clear and concise.`
};
```

### 4. Log Analysis Orchestrator

**File**: `src/ai/LogAnalysisOrchestrator.ts`

```typescript
export class LogAnalysisOrchestrator {
  private provider: IAIProvider;
  
  constructor(private context: vscode.ExtensionContext) {}
  
  async initialize(): Promise<void> {
    const config = this.getConfigFromSettings();
    this.provider = new OllamaProvider();
    await this.provider.initialize(config);
  }
  
  async analyzeSearchResults(
    searchResults: any[], // Your existing Sumo Logic result format
    userQuery: string,
    analysisType: 'observability' | 'security' | 'general' = 'general'
  ): Promise<LogAnalysisResponse> {
    
    // Convert Sumo Logic results to LogEntry format
    const logs = this.convertToLogEntries(searchResults);
    
    // Show progress
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing logs with AI...',
      cancellable: false
    }, async (progress) => {
      
      progress.report({ increment: 0, message: 'Preparing logs...' });
      
      const request: LogAnalysisRequest = {
        logs: logs,
        query: userQuery,
        analysisType: analysisType,
        maxTokens: 2000
      };
      
      progress.report({ increment: 50, message: 'Running analysis...' });
      
      const result = await this.provider.analyzeLog(request);
      
      progress.report({ increment: 100, message: 'Complete!' });
      
      return result;
    });
  }
  
  private convertToLogEntries(searchResults: any[]): LogEntry[] {
    // Convert your Sumo Logic JSON format to LogEntry
    // Adjust based on your actual result structure
    return searchResults.map(result => ({
      timestamp: result._messagetime || result.timestamp || new Date().toISOString(),
      message: result._raw || result.message || JSON.stringify(result),
      severity: result.severity || result.level || 'INFO',
      ...result
    }));
  }
  
  private getConfigFromSettings(): AIProviderConfig {
    const config = vscode.workspace.getConfiguration('sumoLogicAI');
    
    return {
      baseUrl: config.get('ollama.baseUrl', 'http://localhost:11434'),
      model: config.get('ollama.model', 'llama3.1:8b'),
      contextSize: config.get('ollama.contextSize', 4096),
      temperature: config.get('ollama.temperature', 0.3)
    };
  }
  
  async checkHealth(): Promise<boolean> {
    try {
      return await this.provider.healthCheck();
    } catch {
      return false;
    }
  }
}
```

### 5. VS Code Commands

**File**: `src/commands/aiCommands.ts`

```typescript
export function registerAICommands(
  context: vscode.ExtensionContext,
  orchestrator: LogAnalysisOrchestrator
) {
  
  // Command: Analyze current search results
  context.subscriptions.push(
    vscode.commands.registerCommand('sumoLogic.analyzeWithAI', async () => {
      try {
        // Get current search results from your existing extension state
        const searchResults = getCurrentSearchResults(); // Your existing function
        
        if (!searchResults || searchResults.length === 0) {
          vscode.window.showWarningMessage('No search results to analyze. Run a search first.');
          return;
        }
        
        // Get user query
        const query = await vscode.window.showInputBox({
          prompt: 'What would you like to know about these logs?',
          placeHolder: 'e.g., "What errors occurred?" or "Find security issues"'
        });
        
        if (!query) return;
        
        // Determine analysis type
        const analysisType = detectAnalysisType(query);
        
        // Run analysis
        const result = await orchestrator.analyzeSearchResults(
          searchResults,
          query,
          analysisType
        );
        
        // Show results
        await showAnalysisResults(result);
        
      } catch (error) {
        vscode.window.showErrorMessage(`AI Analysis failed: ${error.message}`);
      }
    })
  );
  
  // Command: Check Ollama status
  context.subscriptions.push(
    vscode.commands.registerCommand('sumoLogic.checkAIStatus', async () => {
      const healthy = await orchestrator.checkHealth();
      
      if (healthy) {
        vscode.window.showInformationMessage('✅ Ollama is running and ready');
      } else {
        const action = await vscode.window.showErrorMessage(
          '❌ Ollama is not running',
          'Install Guide',
          'Start Ollama'
        );
        
        if (action === 'Install Guide') {
          vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/download'));
        }
      }
    })
  );
}

function detectAnalysisType(query: string): 'observability' | 'security' | 'general' {
  const securityKeywords = ['security', 'threat', 'attack', 'breach', 'unauthorized', 'suspicious'];
  const obsKeywords = ['performance', 'error', 'latency', 'timeout', 'exception'];
  
  const lowerQuery = query.toLowerCase();
  
  if (securityKeywords.some(kw => lowerQuery.includes(kw))) {
    return 'security';
  }
  if (obsKeywords.some(kw => lowerQuery.includes(kw))) {
    return 'observability';
  }
  return 'general';
}

async function showAnalysisResults(result: LogAnalysisResponse) {
  // Create a webview or document to show results
  const panel = vscode.window.createWebviewPanel(
    'aiAnalysisResults',
    'AI Log Analysis',
    vscode.ViewColumn.Beside,
    {}
  );
  
  panel.webview.html = getResultsHTML(result);
}

function getResultsHTML(result: LogAnalysisResponse): string {
  return `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        h2 { color: var(--vscode-foreground); border-bottom: 1px solid var(--vscode-panel-border); }
        .section { margin: 20px 0; }
        .finding { margin: 10px 0; padding-left: 20px; }
        .summary { background: var(--vscode-textBlockQuote-background); padding: 15px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>🤖 AI Log Analysis Results</h1>
    
    <div class="section">
        <h2>📊 Summary</h2>
        <div class="summary">${result.summary}</div>
    </div>
    
    <div class="section">
        <h2>🔍 Key Findings</h2>
        ${result.keyFindings.map(f => `<div class="finding">• ${f}</div>`).join('')}
    </div>
    
    <div class="section">
        <h2>⚠️ Anomalies</h2>
        ${result.anomalies.length > 0 
          ? result.anomalies.map(a => `<div class="finding">• ${a}</div>`).join('')
          : '<p>No significant anomalies detected</p>'}
    </div>
    
    <div class="section">
        <h2>💡 Recommendations</h2>
        ${result.recommendations.map(r => `<div class="finding">• ${r}</div>`).join('')}
    </div>
</body>
</html>`;
}
```

---

## Configuration

**File**: `package.json` (add to existing configuration)

```json
{
  "contributes": {
    "commands": [
      {
        "command": "sumoLogic.analyzeWithAI",
        "title": "Sumo Logic: Analyze with AI",
        "icon": "$(sparkle)"
      },
      {
        "command": "sumoLogic.checkAIStatus",
        "title": "Sumo Logic: Check AI Status"
      }
    ],
    "configuration": {
      "title": "Sumo Logic AI",
      "properties": {
        "sumoLogicAI.ollama.baseUrl": {
          "type": "string",
          "default": "http://localhost:11434",
          "description": "Ollama API base URL"
        },
        "sumoLogicAI.ollama.model": {
          "type": "string",
          "default": "llama3.1:8b",
          "description": "Ollama model to use for analysis",
          "enum": [
            "llama3.1:8b",
            "llama3.2:3b",
            "mistral:7b-instruct",
            "qwen2.5:7b"
          ]
        },
        "sumoLogicAI.ollama.contextSize": {
          "type": "number",
          "default": 4096,
          "description": "Context window size for the model"
        },
        "sumoLogicAI.ollama.temperature": {
          "type": "number",
          "default": 0.3,
          "minimum": 0,
          "maximum": 1,
          "description": "Temperature for response generation (0 = focused, 1 = creative)"
        }
      }
    }
  }
}
```

---

## Implementation Steps

### Phase 1: Core Integration
1. Create `src/ai/` directory structure
2. Implement `IAIProvider.ts` interface
3. Implement `OllamaProvider.ts`
4. Implement `PromptTemplates.ts`
5. Test Ollama connection and basic analysis

### Phase 2: Orchestration
6. Implement `LogAnalysisOrchestrator.ts`
7. Add conversion logic from Sumo Logic format to `LogEntry`
8. Test end-to-end analysis flow

### Phase 3: VS Code Integration
9. Implement commands in `aiCommands.ts`
10. Add configuration to `package.json`
11. Create results display (webview or document)
12. Add status bar item showing AI availability

### Phase 4: Polish
13. Add error handling and user feedback
14. Add installation check/guide for Ollama
15. Add keyboard shortcuts
16. Write user documentation

---

## Usage Flow

```
1. User runs Sumo Logic search (existing functionality)
   ↓
2. Search results loaded (existing functionality)
   ↓
3. User runs command: "Sumo Logic: Analyze with AI"
   ↓
4. Extension prompts: "What would you like to know?"
   ↓
5. User enters query: "What errors occurred in the last hour?"
   ↓
6. Orchestrator:
   - Converts results to LogEntry format
   - Detects analysis type (observability/security/general)
   - Builds prompt with template
   - Calls Ollama
   ↓
7. Display results in webview panel
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    // Your existing dependencies...
  },
  "devDependencies": {
    // Your existing dev dependencies...
  }
}
```

**Note**: No additional NPM dependencies needed for MVP! Uses native `fetch` API.

---

## Testing Checklist

- [ ] Ollama health check works
- [ ] Can list available models
- [ ] Can analyze sample logs
- [ ] Prompt templates produce good results
- [ ] Results display correctly in webview
- [ ] Configuration settings work
- [ ] Error handling for Ollama not running
- [ ] Error handling for invalid responses
- [ ] Works with raw log results
- [ ] Works with aggregate query results

---

## Future Enhancements (Post-MVP)

- Add more AI providers (OpenAI, Anthropic, etc.)
- Streaming responses for real-time feedback
- Context window management for large log sets
- Analysis result caching
- Export analysis results
- Custom prompt templates
- Semantic search across logs
- Batch analysis for multiple searches

---

## Security Considerations

✅ **Data Privacy**
- All data stays local with Ollama
- No data sent to external services
- No API keys required for MVP

✅ **Configuration**
- All settings stored in VS Code workspace
- User controls model selection
- User controls API endpoint

---

## User Documentation Outline

Create a `docs/AI-ANALYSIS.md` with:

1. **Prerequisites**
   - Install Ollama
   - Download recommended model
   - Verify Ollama is running

2. **Quick Start**
   - Run a search
   - Click "Analyze with AI"
   - Enter your question

3. **Configuration**
   - Changing models
   - Adjusting context size
   - Temperature settings

4. **Best Practices**
   - Good questions to ask
   - Analysis types
   - Interpreting results

5. **Troubleshooting**
   - Ollama not running
   - Model not found
   - Slow responses