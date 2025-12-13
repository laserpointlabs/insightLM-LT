import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SpreadsheetViewerProps {
  content: string;
  filename: string;
  workbookId?: string;
  path?: string;
  onContentChange?: (content: string) => void;
}

interface SpreadsheetData {
  version: string;
  metadata: {
    name: string;
    created_at: string;
    modified_at: string;
    workbook_id: string;
  };
  sheets: Array<{
    id: string;
    name: string;
    cells: Record<string, any>;
    formats: Record<string, any>;
    conditionalFormats?: Record<string, any>; // Conditional formatting rules
  }>;
}

// Convert .is format to Luckysheet format
// Helper function to extract cell references from a formula
function extractCellReferences(formula: string): string[] {
  if (!formula || !formula.startsWith('=')) {
    return [];
  }
  
  // Match cell references like A1, B2, AA10, etc.
  const cellRefPattern = /\b([A-Z]+)(\d+)\b/g;
  const matches: string[] = [];
  let match;
  
  while ((match = cellRefPattern.exec(formula)) !== null) {
    matches.push(match[0]); // Full match like "A1"
  }
  
  return matches;
}

// Helper function to convert column number to letter (0=A, 1=B, 26=AA, etc.)
function colNumToLetter(colNum: number): string {
  let result = '';
  colNum += 1; // Convert to 1-based for calculation
  while (colNum > 0) {
    colNum--;
    result = String.fromCharCode(65 + (colNum % 26)) + result;
    colNum = Math.floor(colNum / 26);
  }
  return result;
}

// Helper function to convert cell reference to row/col
function cellRefToRowCol(cellRef: string): { r: number; c: number } | null {
  const match = cellRef.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  
  const col = match[1];
  const row = parseInt(match[2]) - 1; // 0-based
  
  // Convert column letter to number (A=0, B=1, etc.)
  let colNum = 0;
  for (let i = 0; i < col.length; i++) {
    colNum = colNum * 26 + (col.charCodeAt(i) - 64);
  }
  colNum -= 1; // 0-based
  
  return { r: row, c: colNum };
}

function convertToLuckysheetFormat(data: SpreadsheetData): any[] {
  return data.sheets.map((sheet, index) => {
    // Convert cells to Luckysheet cell format
    const celldata: any[] = [];
    const calcChain: any[] = []; // Formula dependency chain
    
    Object.entries(sheet.cells).forEach(([cellRef, cellData]) => {
      // Parse cell reference (e.g., "A1" -> {r: 0, c: 0})
      const match = cellRef.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const col = match[1];
        const row = parseInt(match[2]) - 1; // Luckysheet uses 0-based rows
        
        // Convert column letter to number (A=0, B=1, AA=26, etc.)
        let colNum = 0;
        for (let i = 0; i < col.length; i++) {
          colNum = colNum * 26 + (col.charCodeAt(i) - 64);
        }
        colNum -= 1; // Convert to 0-based
        
        // Handle nested value structure from Luckysheet format
        // Format can be: { value: 123 } OR { value: { v: 123, f: "=A1*2", m: "123" } }
        let cellValue: any = null;
        let formula: string | null = null;
        let format: any = null;
        
        if (cellData && typeof cellData === 'object') {
          if ('value' in cellData && typeof cellData.value === 'object' && cellData.value !== null) {
            // Nested format: { value: { v: 123, f: "=A1*2", ... } }
            const valueObj = cellData.value;
            cellValue = valueObj.v !== undefined ? valueObj.v : (valueObj.m !== undefined ? valueObj.m : null);
            formula = valueObj.f || null;
            format = valueObj.ct || null;
          } else if ('value' in cellData) {
            // Simple format: { value: 123 }
            cellValue = cellData.value;
          }
          
          // Also check for direct formula property (fallback)
          if (!formula && 'formula' in cellData) {
            formula = cellData.formula;
          }
        }
        
        // CRITICAL: For formula cells, the formula must be INSIDE the v object!
        // Format: { r: 0, c: 2, v: { f: "=sum(A1:B1)", v: calculatedValue, m: displayValue } }
        // NOT: { r: 0, c: 2, v: 6155, f: "=sum(A1:B1)" } <- WRONG!
        const cell: any = {
          r: row,
          c: colNum,
        };
        
        // Add formula if present - formula goes INSIDE v object
        if (formula) {
          // Formula cell: v must be an object with f, v, m, and ct properties
          cell.v = {
            f: formula,  // Formula string (REQUIRED)
            v: null,    // Calculated value - set to null so Luckysheet recalculates
            m: null,    // Display value - set to null so Luckysheet recalculates
            ct: format || { fa: "General", t: "n" }  // Cell format
          };
          
          // Add to calcChain - format: [true, calculatedValue, formulaString]
          // The calcChain tells Luckysheet which cells have formulas so it can recalculate them
          calcChain.push({
            r: row,
            c: colNum,
            index: index, // Will be updated later to match sheet.index
            func: [true, null, formula], // [isFormula, null (let Luckysheet recalculate), formulaString]
            color: "w", // "w" = depth-first search, "b" = normal search
            parent: null,
            chidren: {}, // Note: typo in Luckysheet API (should be "children")
            times: 0
          });
          
          // Convert colNum back to letter for logging (only log first few to avoid spam)
          if (calcChain.length <= 5) {
            const colLetter = colNumToLetter(colNum);
            console.log(`calcChain[${calcChain.length - 1}]: ${colLetter}${row + 1} = ${formula}`);
          }
        } else {
          // Regular cell - v can be a simple value or object with format
          if (format) {
            cell.v = {
              v: cellValue,
              m: cellValue !== null ? String(cellValue) : null,
              ct: format
            };
          } else {
            cell.v = cellValue;
          }
        }
        
        // Add format if present
        if (format) {
          cell.ct = format;
        } else if (sheet.formats[cellRef]) {
          cell.ct = sheet.formats[cellRef];
        }
        
        celldata.push(cell);
      }
    });
    
    // Use the array index as the sheet index (Luckysheet expects numeric index)
    const sheetIndex = index;
    
    const sheetData: any = {
      name: sheet.name,
      index: sheetIndex, // Use numeric index, not string id
      celldata: celldata,
      order: index,
      status: 1, // 1 = visible
    };
    
    // Add calcChain if there are formulas - IMPORTANT: index must match sheet.index
    if (calcChain.length > 0) {
      // Update all calcChain entries to use the correct sheet index
      calcChain.forEach(entry => {
        entry.index = sheetIndex;
      });
      sheetData.calcChain = calcChain;
    }
    
    // Add conditional formatting rules if present
    if (sheet.conditionalFormats && Object.keys(sheet.conditionalFormats).length > 0) {
      // Convert conditional formats to Luckysheet format
      // According to Luckysheet docs, conditional formatting is stored in luckysheet_conditionformat_save
      // The docs show it as an object {}, but it can also be an array []
      // We'll convert our object format to an array format (which is more common)
      const cfRules: any[] = [];
      Object.values(sheet.conditionalFormats).forEach((rule: any) => {
        // Ensure rule has required properties for Luckysheet
        if (rule && typeof rule === 'object') {
          // Ensure cellrange is in the correct format (array of {row: [start, end], column: [start, end]})
          // If it's a string like "A1:A10", we need to convert it
          if (rule.cellrange && typeof rule.cellrange === 'string') {
            // Convert string format to array format if needed
            // For now, keep as is - Luckysheet should handle it
          }
          cfRules.push(rule);
        }
      });
      if (cfRules.length > 0) {
        // Use the correct property name: luckysheet_conditionformat_save
        // According to docs, it's stored as an object {}, but arrays also work
        // Use array format as it's more straightforward
        sheetData.luckysheet_conditionformat_save = cfRules;
        console.log(`[SpreadsheetViewer] Adding ${cfRules.length} conditional formatting rule(s) to sheet ${sheet.name}`);
        console.log(`[SpreadsheetViewer] CF rules sample:`, JSON.stringify(cfRules[0]).substring(0, 300));
        console.log(`[SpreadsheetViewer] Full CF rule structure:`, JSON.stringify(cfRules[0], null, 2));
      }
    } else {
      console.log(`[SpreadsheetViewer] No conditional formatting found for sheet ${sheet.name}`);
      // Debug: log sheet structure to see what properties exist
      console.log(`[SpreadsheetViewer] Sheet properties:`, Object.keys(sheet));
    }
    
    return sheetData;
  });
}

// Convert Luckysheet format back to .is format
function convertFromLuckysheetFormat(luckysheetData: any[], metadata: SpreadsheetData['metadata']): SpreadsheetData {
  const sheets = luckysheetData.map((sheet) => {
    const cells: Record<string, any> = {};
    const formats: Record<string, any> = {};
    const conditionalFormats: Record<string, any> = {}; // Store conditional formatting rules
    
    if (sheet.celldata) {
      sheet.celldata.forEach((cell: any) => {
        // Convert row/col to cell reference (e.g., {r: 0, c: 0} -> "A1")
        const col = String.fromCharCode(65 + cell.c); // A=65
        const row = cell.r + 1; // 1-based
        const cellRef = `${col}${row}`;
        
        const cellData: any = {};
        
        if (cell.f) {
          // Has formula
          cellData.formula = cell.f;
          cellData.value = cell.v !== null && cell.v !== undefined ? cell.v : null;
        } else {
          // Plain value
          cellData.value = cell.v !== null && cell.v !== undefined ? cell.v : null;
        }
        
        cells[cellRef] = cellData;
        
        if (cell.ct) {
          formats[cellRef] = cell.ct;
        }
      });
    }
    
    // Extract conditional formatting rules from Luckysheet sheet data
    // Luckysheet stores conditional formatting in luckysheet_conditionformat_save property
    // According to Luckysheet docs: https://dream-num.github.io/LuckysheetDocs/zh/guide/config.html
    // The property name is luckysheet_conditionformat_save (not luckysheet_conditionformat)
    const cfData = sheet.luckysheet_conditionformat_save || sheet.luckysheet_conditionformat || sheet.conditionformat || sheet.cf;
    
    if (cfData) {
      console.log(`[SpreadsheetViewer] Found conditional formatting data for sheet ${sheet.name}:`, 
        Array.isArray(cfData) ? `Array with ${cfData.length} rules` : `Type: ${typeof cfData}`);
      
      // Handle different formats:
      // 1. Array format: [{rule1}, {rule2}]
      // 2. Object format: {0: {rule1}, 1: {rule2}} or {key1: rule1, key2: rule2}
      // 3. Object with rules property: {rules: [{rule1}, {rule2}]}
      let cfRules: any[] = [];
      
      if (Array.isArray(cfData)) {
        cfRules = cfData;
      } else if (typeof cfData === 'object' && cfData !== null) {
        // Check if it's an object with numeric keys (indexed format)
        const keys = Object.keys(cfData);
        const numericKeys = keys.filter(k => !isNaN(Number(k)));
        if (numericKeys.length > 0) {
          // It's an object keyed by index: {0: rule1, 1: rule2}
          cfRules = numericKeys.map(k => cfData[k]).filter(r => r != null);
        } else if (cfData.rules && Array.isArray(cfData.rules)) {
          // It has a rules property
          cfRules = cfData.rules;
        } else {
          // Single rule object or object with string keys - extract all values
          cfRules = Object.values(cfData).filter(r => r != null && typeof r === 'object');
        }
      }
      
      if (cfRules.length > 0) {
        cfRules.forEach((rule: any, index: number) => {
          // Store rule with a key that includes cell range
          const cellRange = rule.cellrange || rule.range || rule.cellRange || `rule_${index}`;
          conditionalFormats[cellRange] = rule;
          console.log(`[SpreadsheetViewer] Extracted conditional format rule ${index}:`, 
            JSON.stringify(rule).substring(0, 200));
        });
      }
    } else {
      // Debug: log all sheet keys to see what's available
      const sheetKeys = Object.keys(sheet);
      const cfRelatedKeys = sheetKeys.filter(k => 
        k.toLowerCase().includes('condition') || 
        k.toLowerCase().includes('format') || 
        k === 'cf'
      );
      if (cfRelatedKeys.length > 0) {
        console.log(`[SpreadsheetViewer] Sheet has CF-related keys but no CF data:`, cfRelatedKeys);
      }
    }
    
    const sheetData: any = {
      id: sheet.index || `sheet${sheet.order || 0}`,
      name: sheet.name || 'Sheet1',
      cells,
      formats,
    };
    
    // Add conditional formatting if present
    if (Object.keys(conditionalFormats).length > 0) {
      sheetData.conditionalFormats = conditionalFormats;
    }
    
    return sheetData;
  });
  
  return {
    version: '1.0',
    metadata: {
      ...metadata,
      modified_at: new Date().toISOString(),
    },
    sheets,
  };
}

export function SpreadsheetViewer({ 
  content, 
  filename, 
  workbookId, 
  path,
  onContentChange 
}: SpreadsheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [chartPluginLoaded, setChartPluginLoaded] = useState(false);
  const luckysheetInitialized = useRef(false);
  const currentFilenameRef = useRef<string | null>(null); // Track which filename is currently initialized
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveSpreadsheetRef = useRef<(() => void) | null>(null);

  // Load Luckysheet CSS and JS
  useEffect(() => {
    // Check if scripts are already loaded globally
    if ((window as any).jQuery && (window as any).luckysheet) {
      console.log('Luckysheet scripts already loaded, skipping reload');
      setScriptsLoaded(true);
      return;
    }

    if (scriptsLoaded) return;

    // Track loaded CSS to avoid duplicates
    const loadedCSS = new Set<string>();
    const loadedScripts = new Set<string>();

    // Helper to check if CSS is already loaded
    const isCSSLoaded = (href: string): boolean => {
      return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(
        (link: any) => link.href === href
      );
    };

    // Helper to check if script is already loaded
    const isScriptLoaded = (src: string): boolean => {
      return Array.from(document.querySelectorAll('script')).some(
        (script: any) => script.src === src
      );
    };

    // Load CSS only if not already loaded
    const cssLinks = [
      'https://cdn.jsdelivr.net/npm/luckysheet@2.1.13/dist/plugins/css/pluginsCss.css',
      'https://cdn.jsdelivr.net/npm/luckysheet@2.1.13/dist/plugins/plugins.css',
      'https://cdn.jsdelivr.net/npm/luckysheet@2.1.13/dist/css/luckysheet.css',
      'https://cdn.jsdelivr.net/npm/luckysheet@2.1.13/dist/assets/iconfont/iconfont.css',
    ];

    cssLinks.forEach((href) => {
      if (!isCSSLoaded(href) && !loadedCSS.has(href)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-luckysheet-css', 'true'); // Mark for potential cleanup
        document.head.appendChild(link);
        loadedCSS.add(href);
      }
    });

    // Load jQuery first (required by Luckysheet) - only if not already loaded
    const jqueryUrl = 'https://code.jquery.com/jquery-3.6.0.min.js';
    
    // Helper to ensure jQuery is ready before loading dependent scripts
    const ensureJQueryReady = (callback: () => void) => {
      if ((window as any).jQuery && typeof (window as any).jQuery === 'function') {
        // jQuery is loaded and ready
        callback();
      } else {
        // Wait for jQuery to be available
        const checkInterval = setInterval(() => {
          if ((window as any).jQuery && typeof (window as any).jQuery === 'function') {
            clearInterval(checkInterval);
            callback();
          }
        }, 50);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!(window as any).jQuery) {
            console.error('jQuery failed to load within timeout');
            setError('Failed to load jQuery');
          }
        }, 5000);
      }
    };
    
    if ((window as any).jQuery && typeof (window as any).jQuery === 'function') {
      console.log('jQuery already loaded, proceeding to Luckysheet');
      ensureJQueryReady(() => loadLuckysheetScripts());
    } else if (isScriptLoaded(jqueryUrl)) {
      // Script tag exists, wait for it to load
      console.log('jQuery script tag found, waiting for it to load...');
      ensureJQueryReady(() => loadLuckysheetScripts());
    } else {
      const jqueryScript = document.createElement('script');
      jqueryScript.src = jqueryUrl;
      jqueryScript.setAttribute('data-luckysheet-script', 'jquery');
        jqueryScript.onload = () => {
          console.log('jQuery script loaded, ensuring it\'s ready...');
          ensureJQueryReady(() => loadLuckysheetScripts());
        };
      jqueryScript.onerror = () => {
        console.error('Failed to load jQuery');
        setError('Failed to load required scripts');
      };
      document.body.appendChild(jqueryScript);
      loadedScripts.add(jqueryUrl);
    }

    // Define loadPluginScript and loadMainScript BEFORE loadLuckysheetScripts so they're in scope
    function loadMainScript() {
      const mainUrl = 'https://cdn.jsdelivr.net/npm/luckysheet@2.1.13/dist/luckysheet.umd.js';
      if ((window as any).luckysheet || isScriptLoaded(mainUrl)) {
        console.log('Luckysheet main script already loaded');
        setScriptsLoaded(true);
        return;
      }

      const mainScript = document.createElement('script');
      mainScript.src = mainUrl;
      mainScript.setAttribute('data-luckysheet-script', 'main');
      mainScript.onload = () => {
        setScriptsLoaded(true);
        
        // Chart support temporarily disabled - ChartMix requires complex Vue/Vuex setup
        // and causes errors if not perfectly configured. Will be added in Phase 2.
        // For now, skip loading ChartMix dependencies to avoid errors
        console.log('Chart support: Disabled for now. ChartMix requires Vue/Vuex/Element-UI/ECharts setup.');
        console.log('Charts will be available in a future update with proper dependency management.');
        setChartPluginLoaded(false);
      };
      mainScript.onerror = () => {
        console.error('Failed to load Luckysheet main script');
        setError('Failed to load Luckysheet');
      };
      document.body.appendChild(mainScript);
      loadedScripts.add(mainUrl);
    }

    function loadPluginScript() {
      const pluginUrl = 'https://cdn.jsdelivr.net/npm/luckysheet@2.1.13/dist/plugins/js/plugin.js';
      if (isScriptLoaded(pluginUrl)) {
        console.log('Luckysheet plugins already loaded, loading main script');
        loadMainScript();
      } else {
        const pluginScript = document.createElement('script');
        pluginScript.src = pluginUrl;
        pluginScript.setAttribute('data-luckysheet-script', 'plugin');
        pluginScript.onload = () => {
          loadMainScript();
        };
        pluginScript.onerror = () => {
          console.error('Failed to load Luckysheet plugins');
          setError('Failed to load Luckysheet plugins');
        };
        document.body.appendChild(pluginScript);
        loadedScripts.add(pluginUrl);
      }
    }

    function loadLuckysheetScripts() {
      // CRITICAL: Ensure jQuery is fully loaded before loading mousewheel
      if (!(window as any).jQuery || typeof (window as any).jQuery !== 'function') {
        console.error('jQuery not available when trying to load mousewheel');
        setError('jQuery not available');
        return;
      }
      
      // Load jQuery mousewheel plugin (required by Luckysheet)
      const mousewheelUrl = 'https://cdn.jsdelivr.net/npm/jquery-mousewheel@3.1.13/jquery.mousewheel.min.js';
      
      if ((window as any).jQuery && (window as any).jQuery.fn && (window as any).jQuery.fn.mousewheel) {
        console.log('jQuery mousewheel already loaded');
        loadPluginScript();
      } else if (isScriptLoaded(mousewheelUrl)) {
        // Script tag exists, wait for it to load (but jQuery must be ready first)
        console.log('Mousewheel script tag found, waiting for it to load...');
        const checkMousewheel = setInterval(() => {
          if ((window as any).jQuery && (window as any).jQuery.fn && (window as any).jQuery.fn.mousewheel) {
            clearInterval(checkMousewheel);
            loadPluginScript();
          }
        }, 50);
        
        setTimeout(() => {
          clearInterval(checkMousewheel);
          // If still not loaded, try loading it again
          if (!((window as any).jQuery && (window as any).jQuery.fn && (window as any).jQuery.fn.mousewheel)) {
            console.warn('Mousewheel not loaded, attempting to reload...');
            loadMousewheel();
          }
        }, 1000);
      } else {
        loadMousewheel();
      }

      function loadMousewheel() {
        // Double-check jQuery is available before appending mousewheel script
        if (!(window as any).jQuery || typeof (window as any).jQuery !== 'function') {
          console.error('jQuery not available when trying to append mousewheel script');
          setError('jQuery not available');
          return;
        }
        
        const mousewheelScript = document.createElement('script');
        mousewheelScript.src = mousewheelUrl;
        mousewheelScript.setAttribute('data-luckysheet-script', 'mousewheel');
        mousewheelScript.onload = () => {
          console.log('Mousewheel script loaded successfully');
          loadPluginScript();
        };
        mousewheelScript.onerror = () => {
          console.warn('Failed to load jQuery mousewheel plugin, continuing anyway');
          // Continue even if mousewheel fails - some features may not work
          loadPluginScript();
        };
        document.body.appendChild(mousewheelScript);
        loadedScripts.add(mousewheelUrl);
      }
    }

    // Cleanup function - don't remove scripts as they may be shared
    return () => {
      // Scripts are left in DOM as they may be used by other spreadsheet instances
      // The duplicate check above prevents re-loading
    };
  }, [scriptsLoaded]);

  useEffect(() => {
    try {
      // CRITICAL: Reset initialization flag when content or filename changes (tab switch)
      // This ensures Luckysheet is reinitialized with new content when switching tabs
      const filenameChanged = currentFilenameRef.current !== null && currentFilenameRef.current !== filename;
      if ((luckysheetInitialized.current && (window as any).luckysheet) && filenameChanged) {
        console.log(`Filename changed from "${currentFilenameRef.current}" to "${filename}" - destroying existing Luckysheet instance`);
        try {
          (window as any).luckysheet.destroy();
        } catch (err) {
          console.warn('Error destroying Luckysheet on filename change:', err);
        }
        luckysheetInitialized.current = false;
        // Clear the container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      }
      
      if (!content || content.trim() === '') {
        setError('Spreadsheet file is empty');
        setLoading(false);
        return;
      }
      
      const parsed = JSON.parse(content);
      
      // Validate the parsed structure
      if (!parsed.version || !parsed.sheets || !Array.isArray(parsed.sheets)) {
        setError('Invalid spreadsheet format: missing required fields');
        setLoading(false);
        return;
      }
      
      // Update current filename reference
      currentFilenameRef.current = filename;
      
      setSpreadsheet(parsed);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to parse spreadsheet file:', errorMsg);
      console.error('Content preview (first 500 chars):', content?.substring(0, 500));
      setError(`Failed to parse spreadsheet file: ${errorMsg}`);
      setLoading(false);
    }
  }, [content, filename]); // Added filename to dependencies to reset on tab switch

  // Save spreadsheet function with debouncing (like notebooks) - MUST be defined before initializeLuckysheet
  const saveSpreadsheet = useCallback(() => {
    console.log('saveSpreadsheet called', { 
      hasOnContentChange: !!onContentChange, 
      hasLuckysheet: !!(window as any).luckysheet, 
      hasSpreadsheet: !!spreadsheet 
    });
    
    if (!onContentChange || !(window as any).luckysheet || !spreadsheet) {
      console.warn('saveSpreadsheet: Missing dependencies', { onContentChange: !!onContentChange, luckysheet: !!(window as any).luckysheet, spreadsheet: !!spreadsheet });
      return;
    }
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce save by 300ms to avoid too many calls
    saveTimeoutRef.current = setTimeout(() => {
      try {
        console.log('saveSpreadsheet: Executing save...');
        
        // Try both getAllSheets() and getluckysheetfile() to get complete data including conditional formatting
        const updatedData = (window as any).luckysheet.getAllSheets();
        const luckysheetFile = (window as any).luckysheet.getluckysheetfile();
        
        // Debug: Log ALL properties of the first sheet to find where CF is stored
        if (updatedData && updatedData.length > 0) {
          const firstSheet = updatedData[0];
          console.log(`[saveSpreadsheet] getAllSheets() - First sheet keys:`, Object.keys(firstSheet));
          const hasCF = !!(firstSheet.luckysheet_conditionformat_save || firstSheet.luckysheet_conditionformat || firstSheet.conditionformat || firstSheet.cf);
          console.log(`[saveSpreadsheet] getAllSheets() - First sheet has conditional formatting:`, hasCF);
          if (hasCF) {
            const cf = firstSheet.luckysheet_conditionformat_save || firstSheet.luckysheet_conditionformat || firstSheet.conditionformat || firstSheet.cf;
            console.log(`[saveSpreadsheet] CF data:`, Array.isArray(cf) ? `${cf.length} rules` : typeof cf);
            if (Array.isArray(cf) && cf.length > 0) {
              console.log(`[saveSpreadsheet] First CF rule:`, JSON.stringify(cf[0], null, 2));
            }
          } else {
            // Check for CF in other possible locations
            const allKeys = Object.keys(firstSheet);
            const cfKeys = allKeys.filter(k => k.toLowerCase().includes('condition') || k.toLowerCase().includes('format') || k === 'cf');
            console.log(`[saveSpreadsheet] CF-related keys found:`, cfKeys);
            cfKeys.forEach(key => {
              console.log(`[saveSpreadsheet] ${key}:`, firstSheet[key]);
            });
          }
        }
        
        // Check getluckysheetfile() for conditional formatting
        // getluckysheetfile() has more complete data including luckysheet_conditionformat_save
        if (luckysheetFile && luckysheetFile.length > 0) {
          const firstFile = luckysheetFile[0];
          console.log(`[saveSpreadsheet] getluckysheetfile() - First file keys:`, Object.keys(firstFile));
          const hasCF = !!(firstFile.luckysheet_conditionformat_save || firstFile.luckysheet_conditionformat || firstFile.conditionformat || firstFile.cf);
          console.log(`[saveSpreadsheet] getluckysheetfile() - First file has conditional formatting:`, hasCF);
          if (hasCF) {
            const cf = firstFile.luckysheet_conditionformat_save || firstFile.luckysheet_conditionformat || firstFile.conditionformat || firstFile.cf;
            console.log(`[saveSpreadsheet] File CF data:`, Array.isArray(cf) ? `${cf.length} rules` : typeof cf);
            if (Array.isArray(cf) && cf.length > 0) {
              console.log(`[saveSpreadsheet] File first CF rule:`, JSON.stringify(cf[0], null, 2));
            }
          } else {
            // Check for CF in other possible locations
            const allKeys = Object.keys(firstFile);
            const cfKeys = allKeys.filter(k => k.toLowerCase().includes('condition') || k.toLowerCase().includes('format') || k === 'cf');
            console.log(`[saveSpreadsheet] File CF-related keys found:`, cfKeys);
            cfKeys.forEach(key => {
              console.log(`[saveSpreadsheet] File ${key}:`, firstFile[key]);
            });
          }
          
          // Merge conditional formatting from getluckysheetfile() into getAllSheets() data if needed
          // getluckysheetfile() has luckysheet_conditionformat_save which getAllSheets() might not have
          if (hasCF && updatedData && updatedData.length > 0) {
            const cf = firstFile.luckysheet_conditionformat_save || firstFile.luckysheet_conditionformat || firstFile.conditionformat || firstFile.cf;
            if (!updatedData[0].luckysheet_conditionformat_save && !updatedData[0].luckysheet_conditionformat) {
              console.log(`[saveSpreadsheet] Merging CF from getluckysheetfile() into getAllSheets() data`);
              // Use the correct property name: luckysheet_conditionformat_save
              updatedData[0].luckysheet_conditionformat_save = cf;
            }
          }
        }
        
        // Also try to get CF using Luckysheet's API if available
        try {
          if ((window as any).luckysheet.getConditionFormat) {
            const cfFromAPI = (window as any).luckysheet.getConditionFormat();
            console.log(`[saveSpreadsheet] getConditionFormat() API result:`, cfFromAPI);
            if (cfFromAPI && updatedData && updatedData.length > 0) {
              updatedData[0].luckysheet_conditionformat = cfFromAPI;
            }
          }
        } catch (e) {
          console.log(`[saveSpreadsheet] getConditionFormat() API not available or error:`, e);
        }
        
        // Prefer getluckysheetfile() if it has more complete data (including conditional formatting)
        // getluckysheetfile() often has more complete data than getAllSheets()
        let dataToConvert = updatedData;
        if (luckysheetFile && luckysheetFile.length > 0 && updatedData && updatedData.length > 0) {
          // Merge file data into sheets data, prioritizing file data for conditional formatting
          const fileSheet = luckysheetFile[0];
          const sheet = updatedData[0];
          
          // If file has CF but sheet doesn't, use file data
          // Check for luckysheet_conditionformat_save (correct property name)
          const fileHasCF = !!(fileSheet.luckysheet_conditionformat_save || fileSheet.luckysheet_conditionformat || fileSheet.conditionformat || fileSheet.cf);
          const sheetHasCF = !!(sheet.luckysheet_conditionformat_save || sheet.luckysheet_conditionformat || sheet.conditionformat || sheet.cf);
          
          if (fileHasCF && !sheetHasCF) {
            console.log(`[saveSpreadsheet] File has CF but sheet doesn't - merging file data`);
            // Copy conditional formatting from file to sheet
            if (fileSheet.luckysheet_conditionformat_save) {
              sheet.luckysheet_conditionformat_save = fileSheet.luckysheet_conditionformat_save;
            } else if (fileSheet.luckysheet_conditionformat) {
              sheet.luckysheet_conditionformat_save = fileSheet.luckysheet_conditionformat;
            }
          } else if (fileHasCF && sheetHasCF) {
            // Both have CF, prefer file version (it's more complete)
            console.log(`[saveSpreadsheet] Both have CF - using file version`);
            const cf = fileSheet.luckysheet_conditionformat_save || fileSheet.luckysheet_conditionformat || fileSheet.conditionformat || fileSheet.cf;
            sheet.luckysheet_conditionformat_save = cf;
          }
        }
        
        const converted = convertFromLuckysheetFormat(dataToConvert, spreadsheet.metadata);
        
        // Debug: Check if conditional formatting made it into converted data
        if (converted.sheets && converted.sheets.length > 0) {
          const firstSheet = converted.sheets[0];
          const hasCF = !!(firstSheet.conditionalFormats && Object.keys(firstSheet.conditionalFormats).length > 0);
          console.log(`[saveSpreadsheet] Converted data has conditional formatting:`, hasCF);
          if (hasCF) {
            console.log(`[saveSpreadsheet] CF rules in converted:`, Object.keys(firstSheet.conditionalFormats));
          }
        }
        
        const jsonContent = JSON.stringify(converted, null, 2);
        console.log('saveSpreadsheet: Calling onContentChange with', jsonContent.length, 'bytes');
        // This will trigger setUnsavedContent in DocumentViewer, showing the orange dot
        onContentChange(jsonContent);
        console.log('saveSpreadsheet: onContentChange called successfully');
      } catch (err) {
        console.error('Failed to save spreadsheet:', err);
      }
    }, 300);
  }, [onContentChange, spreadsheet]);
  
  // Keep ref updated with latest save function
  useEffect(() => {
    saveSpreadsheetRef.current = saveSpreadsheet;
  }, [saveSpreadsheet]);

  const initializeLuckysheet = React.useCallback(() => {
    if (!spreadsheet || !containerRef.current || !saveSpreadsheetRef.current) {
      return;
    }

    // If already initialized for a different filename, destroy and reinitialize
    const filenameChanged = currentFilenameRef.current !== null && currentFilenameRef.current !== filename;
    if (luckysheetInitialized.current && (window as any).luckysheet && filenameChanged) {
      console.log(`Reinitializing Luckysheet - filename changed from "${currentFilenameRef.current}" to "${filename}"`);
      try {
        (window as any).luckysheet.destroy();
        luckysheetInitialized.current = false;
        // Clear the container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      } catch (err) {
        console.warn('Error destroying existing Luckysheet instance:', err);
        // Clear the container anyway
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        luckysheetInitialized.current = false;
      }
    }

    // Don't reinitialize if already initialized for the same filename
    if (luckysheetInitialized.current && currentFilenameRef.current === filename) {
      console.log(`Luckysheet already initialized for "${filename}", skipping reinitialization`);
      return;
    }

    try {
      const luckysheetData = convertToLuckysheetFormat(spreadsheet);
      
      // Debug: Check if conditional formatting is in the data being passed to Luckysheet
      if (luckysheetData && luckysheetData.length > 0) {
        const firstSheet = luckysheetData[0];
        const hasCF = !!(firstSheet.luckysheet_conditionformat_save || firstSheet.luckysheet_conditionformat);
        console.log(`[initializeLuckysheet] First sheet has conditional formatting:`, hasCF);
        if (hasCF) {
          const cf = firstSheet.luckysheet_conditionformat_save || firstSheet.luckysheet_conditionformat;
          if (Array.isArray(cf)) {
            console.log(`[initializeLuckysheet] CF rules count:`, cf.length);
            console.log(`[initializeLuckysheet] First CF rule:`, JSON.stringify(cf[0], null, 2));
          } else if (typeof cf === 'object') {
            const cfKeys = Object.keys(cf);
            console.log(`[initializeLuckysheet] CF rules count:`, cfKeys.length);
            console.log(`[initializeLuckysheet] First CF rule:`, JSON.stringify(cf[cfKeys[0]], null, 2));
          }
        }
      }
      
      const containerId = `luckysheet-${filename.replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      if (containerRef.current) {
        containerRef.current.id = containerId;
      }
      
      console.log('Initializing Luckysheet with hooks...');
      
      // Chart support is disabled for now due to ChartMix complexity
      // ChartMix requires Vue/Vuex/Element-UI/ECharts and proper store initialization
      // This causes errors if not set up perfectly. Charts will be added in Phase 2.
      // For now, we'll initialize without charts to avoid errors
      const plugins: string[] = [];
      // Don't enable charts - ChartMix setup is complex and causes errors
      // TODO: Phase 2 - Properly integrate ChartMix with all dependencies
      
      // Debug: Log calcChain info (avoid JSON.stringify to prevent circular reference errors)
      if (luckysheetData[0]?.calcChain && luckysheetData[0].calcChain.length > 0) {
        console.log(`calcChain: ${luckysheetData[0].calcChain.length} formula(s) registered`);
      }
      
      (window as any).luckysheet.create({
        container: containerId,
        data: luckysheetData,
        plugins: plugins.length > 0 ? plugins : undefined,
        options: {
          allowCopy: true,
          allowEdit: true,
          allowDelete: true,
          allowCreate: true,
          showtoolbar: true,
          showinfobar: false,
          showsheetbar: true,
          showstatisticBar: false,
          enableAddRow: true,
          enableAddCol: true,
          // Enable formula calculation (Luckysheet's built-in engine)
          functionButton: true,
          // Force calculation to ensure formulas update when cells change
          forceCalculation: true,
          // Charts disabled - ChartMix requires complex setup
          allowChart: false,
        },
        hook: {
          // Hook for when cells are edited (before save)
          cellEditBefore: async (r: number, c: number, oldValue: any) => {
            // This fires before cell edit - we can use it to detect formula input
          },
          // Hook for when cells are edited (after save) - THIS IS THE KEY HOOK
          cellEditAfter: (r: number, c: number, oldValue: any, newValue: any, isRefresh: boolean) => {
            console.log('cellEditAfter FIRED:', { r, c, oldValue, newValue, isRefresh });
            // Don't save if this is a refresh (programmatic update from recalculation)
            // We'll save after recalculation completes via cellUpdated
            if (!isRefresh) {
              // User edit - trigger formula refresh IMMEDIATELY
              // Use requestAnimationFrame to ensure DOM is updated first
              requestAnimationFrame(() => {
                // Force formula refresh to ensure dependent cells recalculate
                if ((window as any).luckysheet && typeof (window as any).luckysheet.refreshFormula === 'function') {
                  console.log('Calling refreshFormula() after cell edit');
                  (window as any).luckysheet.refreshFormula({
                    success: () => {
                      console.log('refreshFormula completed successfully');
                    }
                  });
                }
                // Save after recalculation completes
                setTimeout(() => {
                  if (saveSpreadsheetRef.current) {
                    console.log('Calling saveSpreadsheet from cellEditAfter (user edit)');
                    saveSpreadsheetRef.current();
                  }
                }, 300);
              });
            }
          },
          // Hook for when cells are updated (including formula recalculation)
          cellUpdated: (r: number, c: number, oldValue: any, newValue: any, isRefresh: boolean) => {
            console.log('cellUpdated FIRED:', { r, c, oldValue, newValue, isRefresh });
            // Save after recalculation completes (isRefresh=true means formula was recalculated)
            // Use a longer delay to ensure all dependent cells have been updated
            setTimeout(() => {
              if (saveSpreadsheetRef.current) {
                console.log('Calling saveSpreadsheet from cellUpdated (recalculation complete)');
                saveSpreadsheetRef.current();
              }
            }, 200);
          },
          // Also hook into cellUpdateBefore to catch all edits
          cellUpdateBefore: (r: number, c: number, oldValue: any, newValue: any) => {
            console.log('cellUpdateBefore FIRED:', { r, c, oldValue, newValue });
            setTimeout(() => {
              if (saveSpreadsheetRef.current) {
                console.log('Calling saveSpreadsheet from cellUpdateBefore');
                saveSpreadsheetRef.current();
              }
            }, 0);
          },
          // Hook for when sheet is updated (includes conditional formatting changes)
          updated: () => {
            console.log('updated hook FIRED - sheet data changed (may include conditional formatting)');
            setTimeout(() => {
              if (saveSpreadsheetRef.current) {
                console.log('Calling saveSpreadsheet from updated hook');
                saveSpreadsheetRef.current();
              }
            }, 300);
          },
          // Hook for when sheet configuration changes
          sheetUpdated: (sheetIndex: number) => {
            console.log('sheetUpdated hook FIRED - sheet configuration changed:', sheetIndex);
            setTimeout(() => {
              if (saveSpreadsheetRef.current) {
                console.log('Calling saveSpreadsheet from sheetUpdated hook');
                saveSpreadsheetRef.current();
              }
            }, 300);
          },
        },
      });
      
      luckysheetInitialized.current = true;
      currentFilenameRef.current = filename; // Track which filename is initialized
      console.log(`Luckysheet initialized for "${filename}", hooks registered`);
      
      // Set up periodic check for conditional formatting changes
      // This is a fallback in case hooks don't fire for conditional formatting
      const cfCheckInterval = setInterval(() => {
        if (!luckysheetInitialized.current || !saveSpreadsheetRef.current) {
          clearInterval(cfCheckInterval);
          return;
        }
        
        try {
          // Get current conditional formatting
          const currentSheets = (window as any).luckysheet.getAllSheets();
          if (currentSheets && currentSheets.length > 0) {
            const currentCF = currentSheets[0].luckysheet_conditionformat_save || currentSheets[0].luckysheet_conditionformat || currentSheets[0].conditionformat || null;
            const lastCF = (window as any).__lastCFState;
            
            // Normalize both to arrays or null for comparison
            // Handle undefined/null properly - JSON.stringify(undefined) returns undefined, not a string!
            let currentCFStr: string;
            if (currentCF === null || currentCF === undefined) {
              currentCFStr = 'null';
            } else {
              try {
                const stringified = JSON.stringify(currentCF);
                // JSON.stringify should never return undefined, but check anyway
                currentCFStr = (stringified === undefined || stringified === null) ? 'null' : stringified;
              } catch (e) {
                currentCFStr = 'null';
              }
            }
            
            let lastCFStr: string;
            if (lastCF === null || lastCF === undefined) {
              lastCFStr = 'null';
            } else {
              try {
                const stringified = JSON.stringify(lastCF);
                // JSON.stringify should never return undefined, but check anyway
                lastCFStr = (stringified === undefined || stringified === null) ? 'null' : stringified;
              } catch (e) {
                lastCFStr = 'null';
              }
            }
            
            // Compare with last known state
            if (currentCFStr !== lastCFStr) {
              console.log('[CF Check] Conditional formatting changed, triggering save');
              // Deep copy current state (handle null/undefined properly)
              if (currentCF === null || currentCF === undefined) {
                (window as any).__lastCFState = null;
              } else {
                try {
                  const stringified = JSON.stringify(currentCF);
                  // JSON.stringify can return undefined in edge cases, check for it
                  if (stringified === undefined || stringified === null) {
                    (window as any).__lastCFState = null;
                  } else {
                    (window as any).__lastCFState = JSON.parse(stringified);
                  }
                } catch (e) {
                  console.warn('[CF Check] Error copying CF state:', e);
                  (window as any).__lastCFState = null;
                }
              }
              if (saveSpreadsheetRef.current) {
                saveSpreadsheetRef.current();
              }
            }
          }
        } catch (err) {
          console.warn('[CF Check] Error checking conditional formatting:', err);
        }
      }, 2000); // Check every 2 seconds
      
      // Store interval ID for cleanup
      (window as any).__spreadsheetCFCheck = cfCheckInterval;
      
      // Store initial CF state
      try {
        const initialSheets = (window as any).luckysheet.getAllSheets();
        if (initialSheets && initialSheets.length > 0) {
          const initialCF = initialSheets[0].luckysheet_conditionformat_save || initialSheets[0].luckysheet_conditionformat || initialSheets[0].conditionformat || null;
          (window as any).__lastCFState = initialCF ? JSON.parse(JSON.stringify(initialCF)) : null;
        }
      } catch (err) {
        console.warn('[CF Check] Error storing initial CF state:', err);
        (window as any).__lastCFState = null;
      }
      
      // CRITICAL: Force recalculation after initialization
      // Luckysheet doesn't automatically recalculate formulas on load, even with calcChain
      // We must explicitly call refreshFormula() to trigger calculation
      setTimeout(() => {
        if ((window as any).luckysheet) {
          console.log('Calling refreshFormula() after initialization to recalculate all formulas');
          try {
            // Call refreshFormula multiple times to ensure it works
            (window as any).luckysheet.refreshFormula({
              success: () => {
                console.log('refreshFormula completed - checking if formulas updated');
                // Verify the calculation worked
                setTimeout(() => {
                  const file = (window as any).luckysheet.getluckysheetfile();
                  if (file && file[0]) {
                    const c1Cell = file[0].celldata?.find((c: any) => c.r === 0 && c.c === 2);
                    console.log('C1 after refreshFormula:', c1Cell);
                  }
                }, 100);
              }
            });
          } catch (e) {
            console.error('Error calling refreshFormula:', e);
          }
        }
      }, 1000); // Longer delay to ensure Luckysheet is fully initialized
      
      // Also set up a periodic check for changes as a fallback
      const changeCheckInterval = setInterval(() => {
        if (luckysheetInitialized.current && saveSpreadsheetRef.current) {
          // This is a fallback - the hooks should handle it, but this ensures we catch changes
          // We'll remove this once hooks are confirmed working
        }
      }, 2000);
      
      // Store interval ID for cleanup
      (window as any).__spreadsheetChangeCheck = changeCheckInterval;
      
      // Hide ONLY the Luckysheet branding/info bar (not the toolbar!)
      setTimeout(() => {
        const styleId = 'insight-sheet-hide-branding';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            /* Hide the info bar that contains "Luckysheet Demo" branding */
            .luckysheet_info_detail,
            .luckysheet_info_detail_back,
            .luckysheet_info_detail_update,
            .luckysheet_info_detail_save {
              height: 0 !important;
              min-height: 0 !important;
              max-height: 0 !important;
              overflow: hidden !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
            }
            
            /* Ensure toolbar stays visible - do NOT hide these */
            .luckysheet-wa-editor.toolbar,
            .luckysheet-toolbar-left-theme,
            .luckysheet-toolbar-button,
            .luckysheet-toolbar-menu-button {
              /* Keep all toolbar elements visible */
            }
          `;
          document.head.appendChild(style);
        }
      }, 500);
    } catch (err) {
      console.error('Failed to initialize Luckysheet:', err);
      setError('Failed to initialize spreadsheet editor');
    }
  }, [spreadsheet, filename, saveSpreadsheet]);

  // Initialize Luckysheet when ready
  // Note: We initialize immediately even if ChartMix isn't loaded yet
  // ChartMix will be available later if dependencies load successfully
  useEffect(() => {
    if (!spreadsheet || !containerRef.current || !scriptsLoaded || luckysheetInitialized.current || !saveSpreadsheetRef.current) {
      return;
    }

    // Wait for luckysheet to be available
    const checkLuckysheet = setInterval(() => {
      if ((window as any).luckysheet) {
        clearInterval(checkLuckysheet);
        initializeLuckysheet();
      }
    }, 100);

    return () => {
      clearInterval(checkLuckysheet);
    };
  }, [spreadsheet, scriptsLoaded, saveSpreadsheet, initializeLuckysheet]);

  // Calculate formula via MCP server (for future use - currently Luckysheet handles formulas)
  // This is kept for when we want to use Python-driven formulas, but for now
  // we let Luckysheet's built-in engine handle formulas to avoid breaking existing functionality
  const calculateFormula = async (formula: string, cellRef: string, sheetId: string): Promise<any> => {
    if (!window.electronAPI?.mcp?.call) {
      console.warn('MCP API not available');
      return null;
    }

    try {
      // Get current cell values as context
      const luckysheet = (window as any).luckysheet;
      if (!luckysheet) return null;

      const currentSheet = luckysheet.getSheetByIndex();
      const context: Record<string, any> = {};

      // Build context from all cells in current sheet
      if (currentSheet && currentSheet.celldata) {
        currentSheet.celldata.forEach((cell: any) => {
          const col = String.fromCharCode(65 + cell.c);
          const row = cell.r + 1;
          const ref = `${col}${row}`;
          if (cell.v !== null && cell.v !== undefined) {
            context[ref] = cell.v;
          }
        });
      }

      // Call MCP server to calculate formula
      const result = await window.electronAPI.mcp.call(
        'spreadsheet-server',
        'spreadsheet/calculate_cell',
        {
          sheet_id: sheetId,
          cell_ref: cellRef,
          formula: formula,
          context: context,
        }
      );

      if (result && result.result) {
        return result.result;
      }
      return null;
    } catch (err) {
      console.error('Failed to calculate formula:', err);
      return null;
    }
  };

  useEffect(() => {
    return () => {
      // Clear save timeout on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Clear conditional formatting check interval
      if ((window as any).__spreadsheetCFCheck) {
        clearInterval((window as any).__spreadsheetCFCheck);
        (window as any).__spreadsheetCFCheck = null;
      }
      // Clear CF state tracking
      if ((window as any).__lastCFState) {
        delete (window as any).__lastCFState;
      }
      // Destroy Luckysheet instance
      if (luckysheetInitialized.current && (window as any).luckysheet) {
        try {
          (window as any).luckysheet.destroy();
          luckysheetInitialized.current = false;
          currentFilenameRef.current = null; // Reset filename tracking
        } catch (err) {
          console.error('Error destroying Luckysheet:', err);
        }
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading spreadsheet...</div>
      </div>
    );
  }

  if (error || !spreadsheet) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Error: {error || 'Invalid spreadsheet format'}</div>
      </div>
    );
  }

  if (!scriptsLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading spreadsheet editor...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="border-b p-4 bg-gray-50">
        <h2 className="text-xl font-semibold">{spreadsheet.metadata.name}</h2>
        <p className="text-sm text-gray-600">
          Insight Sheet - Formulas visible in context (no hidden equations!)
        </p>
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        <div 
          ref={containerRef}
          className="w-full h-full absolute"
          style={{ width: '100%', height: '100%', left: 0, top: 0 }}
        />
      </div>
    </div>
  );
}
