import { TVSelectors } from './tv_selectors';
import * as tv_symbols from './tv_symbols';
import { debugLog } from './debug_log';

export interface Setting {
  name: string;
  dataType: 'int' | 'float' | 'checkbox' | 'dropdown' | 'text' | 'session' | string;
  defaultValue: any;
  options?: string[]; // optional — only used for dropdowns
}

const defaultTiming = {
  waitDialog: 500,
  waitReprocess: 3000,
  waitLoad: 600,
  updateDelay: 300,
  waitChartTime: 800,
  waitSettingsClose: 300,
};
const timing = { ...defaultTiming, ...JSON.parse(localStorage.getItem('automation-timing') || '{}') };

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

let lastTimeframe: string | null = null;
let lastSymbol: string | null = null;

export async function closeSettingsDialog(): Promise<boolean> {
  const dialog = document.querySelector(TVSelectors.SETTINGS_DIALOG) as HTMLElement | null;
  if (!dialog) {
    debugLog('warn', '[tv_settings] ⚠️ No settings dialog found to close.');
    return false;
  }

  // Try close (X) button first, then cancel button as fallback
  const closeButton = (dialog.querySelector(TVSelectors.SETTINGS_DIALOG_CLOSE_BUTTON) ||
    dialog.querySelector('button[name="cancel"]')) as HTMLElement | null;
  if (!closeButton) {
    debugLog('warn', '[tv_settings] ❌ Close button not found in settings dialog.');
    return false;
  }

  closeButton.click();
  //console.log('[tv_settings] ✅ Settings dialog closed.');
  return true;
}

/**
 * extractComboboxOptions
 *
 * Opens a combobox dropdown and extracts all available options from the listbox
 */
async function extractComboboxOptions(comboboxButton: HTMLElement): Promise<string[]> {
  const options: string[] = [];

  // Click to open the dropdown
  comboboxButton.click();
  await delay(300);

  // Wait for listbox to appear
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const listbox = document.querySelector(TVSelectors.LISTBOX_POPUP);
    if (listbox) {
      const optionElements = Array.from(listbox.querySelectorAll(TVSelectors.DROPDOWN_OPTION));

      for (const opt of optionElements) {
        const text = opt.textContent?.trim();
        if (text) {
          options.push(text);
        }
      }

      // Close the dropdown by clicking the button again
      (comboboxButton as HTMLElement).click();
      await delay(100);

      debugLog('log', `[tv_settings] 📋 Extracted ${options.length} options from combobox`);
      return options;
    }

    await delay(100);
  }

  // Failed to find listbox, close dropdown
  (comboboxButton as HTMLElement).click();
  debugLog('warn', '[tv_settings] ⚠️ Failed to extract combobox options - listbox not found');
  return [];
}

export async function selectDropdownOption(label: string, value: string): Promise<void> {
  const tries = 15; // Increased retries for slower UI

  debugLog('log', `[tv_settings] 🔽 selectDropdownOption: Looking for "${value}" in dropdown "${label}"`);

  for (let attempt = 1; attempt <= tries; attempt++) {
    // First check if listbox popup is visible
    const listbox = document.querySelector(TVSelectors.LISTBOX_POPUP);
    if (!listbox) {
      debugLog('log', `[tv_settings] ⏳ Waiting for listbox popup... (${attempt}/${tries})`);
      await delay(150);
      continue;
    }

    const options = Array.from(document.querySelectorAll(TVSelectors.DROPDOWN_OPTION));
    debugLog('log', `[tv_settings] 🔍 Found ${options.length} dropdown options`);

    // Try matching by label element first
    let match = options.find(opt => {
      const labelEl = opt.querySelector(TVSelectors.DROPDOWN_OPTION_LABEL);
      const text = labelEl?.textContent?.trim().toLowerCase();
      return text === value.toLowerCase();
    });

    // Fallback: try matching by direct textContent of the option
    if (!match) {
      match = options.find(opt => {
        const text = (opt as HTMLElement).textContent?.trim().toLowerCase();
        return text === value.toLowerCase();
      });
    }

    if (match) {
      debugLog('log', `[tv_settings] ✅ Found option "${value}" for "${label}", selecting...`);
      match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      (match as HTMLElement).click();
      await delay(100); // Small delay after selection
      return;
    }

    // Log available options on last few attempts for debugging
    if (attempt >= tries - 2) {
      const availableOptions = options.map(opt => (opt as HTMLElement).textContent?.trim()).slice(0, 10);
      debugLog('log', `[tv_settings] 📋 Available options: ${JSON.stringify(availableOptions)}`);
    }

    await delay(150);
  }

  debugLog('warn', `[tv_settings] ❌ Option "${value}" not found for "${label}" after ${tries} retries.`);
}

export async function setChartTimeframe(label: string): Promise<boolean> {
  //console.log(`[setChartTimeframe] 🕐 Requested: "${label}"`);

  // Step 1: Click the Time Interval dropdown button
  const menuBtn = document.querySelector(TVSelectors.TIME_INTERVAL_BUTTON) as HTMLElement | null;
  if (!menuBtn) {
    debugLog('warn', '[tv_settings][setChartTimeframe] ❌ Time Interval button not found');
    return false;
  }

  debugLog(
    'log',
    `[tv_settings][setChartTimeframe] 🔘 Clicking timeframe button to open menu (current: ${menuBtn.textContent?.trim()})`,
  );
  menuBtn.click();

  // Step 2: Wait for .menuBox-* to appear and match label
  const maxAttempts = 30;
  const delayMs = 100;

  debugLog('log', `[tv_settings][setChartTimeframe] ⏳ Waiting for menu to appear (looking for "${label}")...`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const menuBox = document.querySelector(TVSelectors.TIMEFRAME_MENU_BOX);
    if (!menuBox) {
      if (attempt === 0) {
        debugLog('log', `[tv_settings][setChartTimeframe] 🔍 Menu not found on first attempt, waiting...`);
      }
      await delay(delayMs);
      continue;
    }

    if (attempt > 0) {
      debugLog(
        'log',
        `[tv_settings][setChartTimeframe] ✅ Menu appeared after ${attempt} attempts (${attempt * delayMs}ms)`,
      );
    }

    const labels = Array.from(menuBox.querySelectorAll(TVSelectors.TIMEFRAME_MENU_LABEL));
    const match = labels.find(span => span.textContent?.trim().toLowerCase() === label.toLowerCase());

    if (match) {
      const row = match.closest(TVSelectors.TIMEFRAME_MUNU_ROW) as HTMLElement;
      if (row) {
        row.click();
        //console.log(`[setChartTimeframe] ✅ Selected: "${label}"`);
        return true;
      }

      debugLog('log', `[tv_settings][setChartTimeframe] ⚠️ Found label but not clickable row: "${label}"`);
      return false;
    }

    await delay(delayMs);
  }

  debugLog('log', `[tv_settings][setChartTimeframe] ❌ Timeout: "${label}" not found`);
  return false;
}

export function extractTabsSetting(): Setting | null {
  const tabButtons = Array.from(document.querySelectorAll(TVSelectors.SETTINGS_DIALOG_TABS));

  const options = tabButtons.map(btn => btn.textContent?.trim()).filter((tab): tab is string => Boolean(tab)); // 👈 fixes TS warning

  const defaultValue = tabButtons
    .find(btn => btn.getAttribute(TVSelectors.SETTINGS_DIALOG_TAB_SELECTED) === 'true')
    ?.textContent?.trim();

  if (options.length && defaultValue) {
    return {
      name: 'tabs',
      dataType: 'text',
      defaultValue,
      options,
    };
  }

  return null;
}

function switchToInputsTabIfNeeded(currentTab?: string): boolean {
  if (!currentTab || currentTab.toLowerCase() === 'inputs') return false;

  const inputsButton = Array.from(document.querySelectorAll(TVSelectors.SETTINGS_DIALOG_TABS)).find(
    btn => btn.textContent?.trim().toLowerCase() === 'inputs',
  );

  if (inputsButton) {
    debugLog('log', '[tv_settings] 🔁 Switching to Inputs tab');
    (inputsButton as HTMLElement).click();
    return true; // 👈 We switched
  }

  return false;
}

/**
 * clickStrategySettings
 *
 * Finds a TradingView strategy element by name, forces its toolbar to display,
 * and simulates a full click sequence (mousedown, mouseup, click) on the settings button.
 *
 * @param desiredStrategy - The strategy name (or part of it) to target.
 */
function clickStrategySettings(desiredStrategy: string): boolean {
  const strategies = Array.from(document.querySelectorAll<HTMLDivElement>(TVSelectors.STRATEGY_LEGEND_ITEM));

  for (const strategyElement of strategies) {
    const titleElement = strategyElement.querySelector<HTMLElement>(TVSelectors.STRATEGY_TITLE);
    const title = titleElement?.textContent?.trim() ?? '';

    debugLog('log', `[tv_settings] 🔍 Checking title: ${title} against desired: ${desiredStrategy}`);

    if (titleElement?.textContent?.includes(desiredStrategy)) {
      const settingsButton = strategyElement.querySelector<HTMLButtonElement>(TVSelectors.STRATEGY_SETTINGS_ACTION);
      if (settingsButton) {
        // Force visibility of the settings button
        settingsButton.classList.remove(TVSelectors.STRATEGY_SETTINGS_REMOVE_BLOCK);
        settingsButton.style.display = 'block';
        settingsButton.style.opacity = '1';

        // Also force toolbar to show if needed
        const toolbar = strategyElement.querySelector<HTMLElement>(TVSelectors.STRATEGY_BUTTONS_WRAPPER);
        if (toolbar) {
          toolbar.classList.remove(TVSelectors.STRATEGY_SETTINGS_REMOVE_BLOCK);
          toolbar.style.display = 'flex';
        }

        // Simulate full click sequence
        const events = ['mousedown', 'mouseup', 'click'].map(
          type => new MouseEvent(type, { bubbles: true, cancelable: true, view: window }),
        );
        events.forEach(e => settingsButton.dispatchEvent(e));
        return true;
      } else {
        debugLog('log', '[tv_settings] Settings button not found for:', titleElement.textContent);
        return false;
      }
    }
  }

  debugLog('log', `[tv_settings] No strategy matching: ${desiredStrategy}`);
  return false;
}

/**
 * scrapeSettingsDialog
 *
 * Scrapes the TradingView settings dialog and returns an array of Setting objects.
 * It handles:
 * - Settings defined in label-input pairs (two cells)
 * - Settings with checkboxes and labels in a single cell.
 *
 * @returns An array of Setting objects.
 */
export async function scrapeSettingsDialog(): Promise<Setting[]> {
  const dialog = document.querySelector(TVSelectors.SETTINGS_DIALOG) as HTMLElement | null;
  if (!dialog) return [];

  const settings: Setting[] = [];

  // ✅ Tabs metadata (e.g. version tabs)
  const tabsMeta = extractTabsSetting();
  if (tabsMeta) {
    const didSwitch = switchToInputsTabIfNeeded(tabsMeta.defaultValue);
    if (didSwitch) await delay(200);
    settings.push(tabsMeta);
  }

  // ✅ Select content again after tab switch
  const content = dialog.querySelector(TVSelectors.SETTINGS_SCROLLABLE_CONTENT) as HTMLElement | null;
  if (!content) return [];

  const cells = Array.from(content.querySelectorAll(TVSelectors.SETTINGS_CELL)) as HTMLElement[];

  // ✅ Add _Symbol dropdown - always shown so users know the capability exists
  // Symbols are scraped on-demand when user selects _Symbol and clicks Continue
  try {
    const symbolRaw = localStorage.getItem('user-symbols');
    const symbolList: string[] = symbolRaw ? JSON.parse(symbolRaw) : [];

    const { exchange, ticker } = tv_symbols.scrapeSymbol();
    const currentSymbol = exchange && ticker ? `${exchange}:${ticker}` : '';

    const defaultSymbol = symbolList.includes(currentSymbol) ? currentSymbol : symbolList[0] || '';

    debugLog('log', `[tv_settings] Adding _Symbol parameter with ${symbolList.length} symbols from watchlist`);
    settings.push({
      name: '_Symbol',
      dataType: 'dropdown',
      defaultValue: defaultSymbol,
      options: symbolList,
    });
  } catch (e) {
    debugLog('warn', '[scrapeSettingsDialog] Failed to load symbols from localStorage, adding empty _Symbol', e);
    // Still add _Symbol with empty options so user knows the capability exists
    settings.push({
      name: '_Symbol',
      dataType: 'dropdown',
      defaultValue: '',
      options: [],
    });
  }

  // ✅ Add _Timeframe dropdown - scrape current timeframe from chart
  let currentTimeframe = '1 hour'; // fallback default
  try {
    // Primary method: Parse from chart canvas aria-label (most reliable)
    // Format: "Chart for CME_MINI:MNQ1!, 5 minutes"
    const chartCanvas = document.querySelector(TVSelectors.chartCanvas);
    if (chartCanvas) {
      const ariaLabel = chartCanvas.getAttribute('aria-label') || '';
      const match = ariaLabel.match(/^Chart for [^,]+,\s*(.+)$/);
      if (match && match[1]) {
        currentTimeframe = match[1].trim();
        debugLog('log', `[tv_settings] Scraped timeframe from canvas aria-label: "${currentTimeframe}"`);
      }
    }

    // Fallback: Try the interval button text if canvas method failed
    if (currentTimeframe === '1 hour') {
      const activeTimeframeButton = document.querySelector(TVSelectors.TIME_INTERVAL_BUTTON) as HTMLElement | null;
      if (activeTimeframeButton) {
        // First try data-value attribute
        const dataValue = activeTimeframeButton.getAttribute('data-value') || '';
        if (dataValue) {
          // Map TradingView's data-value format to our dropdown format
          const timeframeMap: Record<string, string> = {
            '1': '1 minute',
            '2': '2 minutes',
            '3': '3 minutes',
            '5': '5 minutes',
            '10': '10 minutes',
            '15': '15 minutes',
            '30': '30 minutes',
            '45': '45 minutes',
            '60': '1 hour',
            '120': '2 hours',
            '180': '3 hours',
            '240': '4 hours',
            '480': '8 hours',
            '720': '12 hours',
            '1D': '1 day',
            '3D': '3 days',
            '4D': '4 days',
            '5D': '5 days',
            '1W': '1 week',
          };

          if (timeframeMap[dataValue]) {
            currentTimeframe = timeframeMap[dataValue];
            debugLog('log', `[tv_settings] Scraped timeframe from data-value: "${currentTimeframe}"`);
          }
        }

        // If data-value didn't work, try button text content (e.g., "5m", "1h", "1D")
        if (currentTimeframe === '1 hour') {
          const buttonText = activeTimeframeButton.textContent?.trim() || '';
          if (buttonText) {
            // Map short forms to full forms
            const shortFormMap: Record<string, string> = {
              '1m': '1 minute',
              '2m': '2 minutes',
              '3m': '3 minutes',
              '5m': '5 minutes',
              '10m': '10 minutes',
              '15m': '15 minutes',
              '30m': '30 minutes',
              '45m': '45 minutes',
              '1h': '1 hour',
              '2h': '2 hours',
              '3h': '3 hours',
              '4h': '4 hours',
              '8h': '8 hours',
              '12h': '12 hours',
              '1D': '1 day',
              '3D': '3 days',
              '4D': '4 days',
              '5D': '5 days',
              '1W': '1 week',
              '1M': '1 month',
            };

            if (shortFormMap[buttonText]) {
              currentTimeframe = shortFormMap[buttonText];
              debugLog('log', `[tv_settings] Scraped timeframe from button text: "${currentTimeframe}"`);
            }
          }
        }
      }
    }

    debugLog('log', `[tv_settings] Final timeframe for settings: "${currentTimeframe}"`);
  } catch (e) {
    debugLog('warn', '[tv_settings] Failed to scrape current timeframe, using default', e);
  }

  settings.push({
    name: '_Timeframe',
    dataType: 'dropdown',
    defaultValue: currentTimeframe,
    options: [
      '1 minute',
      '2 minutes',
      '3 minutes',
      '5 minutes',
      '10 minutes',
      '15 minutes',
      '30 minutes',
      '45 minutes',
      '1 hour',
      '2 hours',
      '3 hours',
      '4 hours',
      '8 hours',
      '12 hours',
      '1 day',
      '3 days',
      '4 days',
      '5 days',
      '1 week',
    ],
  });

  // ✅ Extract all user inputs
  let lastNamedParam = ''; // Track the last parameter with a real name
  const unnamedCounters: Record<string, number> = {}; // Track sequential numbers per base name
  const seenNames: Record<string, number> = {}; // Track ALL parameter names to deduplicate named duplicates

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.closest(TVSelectors.SETTINGS_TITLE_WRAP)) continue;

    const checkboxEl = cell.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (checkboxEl) {
      const rawLabel =
        cell.querySelector(TVSelectors.SETTINGS_LABEL)?.textContent?.trim() || cell.textContent?.trim() || '';

      let label: string;
      if (rawLabel) {
        label = rawLabel;
        lastNamedParam = rawLabel; // Update last named parameter
      } else {
        // Generate name based on last named parameter
        if (!lastNamedParam) lastNamedParam = 'Parameter';
        unnamedCounters[lastNamedParam] = (unnamedCounters[lastNamedParam] || 0) + 1;
        label = `${lastNamedParam}.${unnamedCounters[lastNamedParam]}`;
      }

      // Deduplicate: if this exact name was already seen, append a suffix
      if (seenNames[label] !== undefined) {
        seenNames[label]++;
        label = `${label}.${seenNames[label]}`;
      }
      seenNames[label] = 0;

      settings.push({ name: label, dataType: 'checkbox', defaultValue: checkboxEl.checked });
      continue;
    }

    const isLabelCell =
      !!cell.querySelector(`[class*="${TVSelectors.SETTINGS_FIRST_CELL_CLASS}"]`) ||
      Array.from(cell.classList).some(c => c.startsWith(TVSelectors.SETTINGS_FIRST_CELL_CLASS));
    const nextCell = cells[i + 1];
    if (isLabelCell && nextCell) {
      const rawLabel = cell.textContent?.trim() || '';

      let label: string;
      if (rawLabel) {
        label = rawLabel;
        lastNamedParam = rawLabel; // Update last named parameter
      } else {
        // Generate name based on last named parameter
        if (!lastNamedParam) lastNamedParam = 'Parameter';
        unnamedCounters[lastNamedParam] = (unnamedCounters[lastNamedParam] || 0) + 1;
        label = `${lastNamedParam}.${unnamedCounters[lastNamedParam]}`;
      }

      // Deduplicate: if this exact name was already seen, append a suffix
      if (seenNames[label] !== undefined) {
        seenNames[label]++;
        label = `${label}.${seenNames[label]}`;
      }
      seenNames[label] = 0;

      // Session detection: check for sessionStart + sessionEnd containers before single-input detection
      const sessionStartEl = nextCell.querySelector(TVSelectors.SESSION_START);
      const sessionEndEl = nextCell.querySelector(TVSelectors.SESSION_END);
      if (sessionStartEl && sessionEndEl) {
        const startInput = sessionStartEl.querySelector('input[name="start"]') as HTMLInputElement | null;
        const endInput = sessionEndEl.querySelector('input[name="end"]') as HTMLInputElement | null;
        const startVal = (startInput?.value ?? '').replace(':', '');
        const endVal = (endInput?.value ?? '').replace(':', '');
        const sessionDefault = `${startVal}-${endVal}`;
        settings.push({ name: label, dataType: 'session', defaultValue: sessionDefault });
        i++;
        continue;
      }

      const inputEl = nextCell.querySelector(
        'input, select, textarea, [role="button"], [role="combobox"]',
      ) as HTMLElement | null;

      if (inputEl) {
        let dataType: Setting['dataType'] = 'text';
        let defaultValue: any = '';
        let options: string[] | undefined = undefined;

        if (inputEl instanceof HTMLInputElement) {
          const val = inputEl.value;
          dataType = !isNaN(Number(val)) && val.trim() !== '' ? 'float' : 'text';
          defaultValue = val;
        } else if (
          inputEl.tagName.toLowerCase() === 'select' ||
          inputEl.getAttribute('role') === 'button' ||
          inputEl.getAttribute('role') === 'combobox'
        ) {
          // Extract current value from middleSlot or fallback to textContent
          const middleSlot = inputEl.querySelector(TVSelectors.COMBOBOX_MIDDLE_SLOT);
          const val = (middleSlot?.textContent?.trim() || inputEl.textContent?.trim() || '').replace(/\s+/g, ' ');

          if (!isNaN(Number(val)) && val.trim() !== '') {
            dataType = 'float';
            defaultValue = val;
          } else {
            dataType = 'dropdown';
            defaultValue = val;

            // ✅ Extract options from combobox if it's a combobox
            if (inputEl.getAttribute('role') === 'combobox') {
              try {
                options = await extractComboboxOptions(inputEl);
              } catch (err) {
                debugLog('warn', '[scrapeSettingsDialog] Failed to extract combobox options:', err);
              }
            }
          }
        }

        settings.push({ name: label, dataType, defaultValue, ...(options && { options }) });
        i++;
      }
    }
  }

  return settings;
}

/**
 * updateSettingsDialog
 *
 * Updates the TradingView settings dialog based on a mapping of setting labels to new values.
 * It handles both checkboxes (in one cell) and label-input pairs.
 *
 * @param newValues - An object where keys are setting names and values are the new values.
 */

export async function updateSettingsDialog(newValues: Record<string, any>, strategyName: string): Promise<void> {
  // const originalDialog = document.querySelector(TVSelectors.SETTINGS_DIALOG);
  // if (!originalDialog) {
  //   console.error('[tv_settings] Settings dialog not found.');
  //   return;
  // }

  // const content = originalDialog.querySelector(TVSelectors.SETTINGS_DIALOG_CONTENT) || originalDialog;

  // if (!content) {
  //   console.error('[tv_settings] Content container not found.');
  //   return;
  // }
  debugLog('log', '[tv_settings] updateSettingsDialog called with newValues: ', newValues);
  let symbolChanged = false;
  let timeframeChanged = false;

  // Scrape current chart symbol/timeframe for smart comparison
  // This ensures we skip changes when the chart already matches (e.g., Time Machine on same chart)
  const currentChartSymbol = tv_symbols.scrapeSymbol();
  const currentSymbolFull =
    currentChartSymbol.exchange && currentChartSymbol.ticker
      ? `${currentChartSymbol.exchange}:${currentChartSymbol.ticker}`
      : currentChartSymbol.ticker || '';

  // 📈 Handle _Symbol first (before anything else)
  if (newValues['_Symbol']) {
    const newSymbol = newValues['_Symbol'];
    // Smart check: skip if chart already has the correct symbol
    if (newSymbol === currentSymbolFull) {
      debugLog('log', `[tv_settings] ✅ Symbol already matches chart: "${newSymbol}" - skipping change`);
    } else if (newSymbol !== lastSymbol) {
      await tv_symbols.changeSymbol(newSymbol);
      lastSymbol = newSymbol;
      symbolChanged = true;
      await delay(JSON.parse(localStorage.getItem('automation-timing') || '{}')?.waitChartSymbol ?? 1000);
    }
    delete newValues['_Symbol'];
  }

  // Scrape current timeframe from chart interval button
  let currentChartTimeframe = '';
  const timeframeButton = document.querySelector(TVSelectors.TIME_INTERVAL_BUTTON);
  if (timeframeButton) {
    currentChartTimeframe = timeframeButton.textContent?.trim()?.toLowerCase() || '';
  }

  // 🕒 Handle _Timeframe first (outside the loop)
  if (newValues['_Timeframe']) {
    const newTF = newValues['_Timeframe'];
    const newTFLower = newTF.toLowerCase();
    // Smart check: skip if chart already has the correct timeframe
    if (newTFLower === currentChartTimeframe || newTF === currentChartTimeframe) {
      debugLog('log', `[tv_settings] ✅ Timeframe already matches chart: "${newTF}" - skipping change`);
    } else if (newTF !== lastTimeframe) {
      const success = await setChartTimeframe(newTF);
      if (success) {
        lastTimeframe = newTF;
        timeframeChanged = true;
        await delay(JSON.parse(localStorage.getItem('automation-timing') || '{}')?.waitChartTime ?? 800);
      } else {
        debugLog('log', `[tv_settings] ❌ Failed to set chart timeframe: "${newTF}"`);
      }
    }
    delete newValues['_Timeframe'];
  }

  const strategyFound = tv_settings.clickStrategySettings(strategyName);
  if (!strategyFound) {
    throw new Error(`STRATEGY_NOT_FOUND:${strategyName}`);
  }
  await delay(JSON.parse(localStorage.getItem('automation-timing') || '{}')?.waitLoad ?? 600);

  // 🆕 Re-query dialog content after possible reopen
  const dialog = document.querySelector(TVSelectors.SETTINGS_DIALOG);
  if (!dialog) {
    debugLog('log', '[tv_settings] Settings dialog not found after reopen (non-critical, may retry).');
    return;
  }

  // 🆕 Ensure we're on the Inputs tab (TradingView remembers last tab)
  const tabsMeta = extractTabsSetting();
  if (tabsMeta) {
    const didSwitch = switchToInputsTabIfNeeded(tabsMeta.defaultValue);
    if (didSwitch) await delay(200);
  }

  const updatedContent = dialog.querySelector(TVSelectors.SETTINGS_DIALOG_CONTENT);
  if (!updatedContent) {
    debugLog('log', '[tv_settings] Content container not found after reopen (non-critical, may retry).');
    return;
  }

  const cells = Array.from(updatedContent.querySelectorAll(TVSelectors.SETTINGS_CELL));
  const processedCheckboxes: Record<string, boolean> = {};
  const appliedParams: Set<string> = new Set(); // Track successfully applied parameters

  // Collect all available labels in the dialog for comparison
  const availableLabels: Set<string> = new Set();
  for (let i = 0; i < cells.length; i++) {
    const cellText = cells[i].textContent?.trim() ?? '';
    if (cellText) availableLabels.add(cellText);
  }

  // Track seen names for deduplication (must mirror scrapeSettingsDialog logic)
  const updateSeenNames: Record<string, number> = {};
  let updateLastNamedParam = '';
  const updateUnnamedCounters: Record<string, number> = {};

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const rawCellText = cell.textContent?.trim() ?? '';

    // Mirror the scrapeSettingsDialog deduplication to get the correct deduplicated label
    let label: string;

    // ✅ Case 1: Checkbox
    const checkboxEl = cell.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (checkboxEl) {
      const rawLabel =
        cell.querySelector(TVSelectors.SETTINGS_LABEL)?.textContent?.trim() || cell.textContent?.trim() || '';

      if (rawLabel) {
        label = rawLabel;
        updateLastNamedParam = rawLabel;
      } else {
        if (!updateLastNamedParam) updateLastNamedParam = 'Parameter';
        updateUnnamedCounters[updateLastNamedParam] = (updateUnnamedCounters[updateLastNamedParam] || 0) + 1;
        label = `${updateLastNamedParam}.${updateUnnamedCounters[updateLastNamedParam]}`;
      }

      // Apply same deduplication as scrape
      if (updateSeenNames[label] !== undefined) {
        updateSeenNames[label]++;
        label = `${label}.${updateSeenNames[label]}`;
      }
      updateSeenNames[label] = 0;

      if (Object.prototype.hasOwnProperty.call(newValues, label) && typeof newValues[label] === 'boolean') {
        const value = newValues[label];
        // Set checkbox directly since we already have the element
        const current = checkboxEl.checked;
        const desired = value === true;
        if (current !== desired) {
          checkboxEl.click();
          checkboxEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        processedCheckboxes[label] = true;
        appliedParams.add(label);
      }
      continue;
    }

    // ✅ Case 2: Text, Numeric, or Dropdown (label cell + input cell pair)
    if (cell.closest(TVSelectors.SETTINGS_TITLE_WRAP)) continue;

    const isLabelCell =
      !!cell.querySelector(`[class*="${TVSelectors.SETTINGS_FIRST_CELL_CLASS}"]`) ||
      Array.from(cell.classList).some(c => c.startsWith(TVSelectors.SETTINGS_FIRST_CELL_CLASS));

    if (!isLabelCell) continue;

    const nextCell = cells[i + 1];
    if (!nextCell) continue;

    const rawLabel = rawCellText;
    if (rawLabel) {
      label = rawLabel;
      updateLastNamedParam = rawLabel;
    } else {
      if (!updateLastNamedParam) updateLastNamedParam = 'Parameter';
      updateUnnamedCounters[updateLastNamedParam] = (updateUnnamedCounters[updateLastNamedParam] || 0) + 1;
      label = `${updateLastNamedParam}.${updateUnnamedCounters[updateLastNamedParam]}`;
    }

    // Apply same deduplication as scrape
    if (updateSeenNames[label] !== undefined) {
      updateSeenNames[label]++;
      label = `${label}.${updateSeenNames[label]}`;
    }
    updateSeenNames[label] = 0;

    // Session value application: detect sessionStart/sessionEnd containers
    const sessionStartContainer = nextCell?.querySelector(TVSelectors.SESSION_START);
    const sessionEndContainer = nextCell?.querySelector(TVSelectors.SESSION_END);
    if (sessionStartContainer && sessionEndContainer && Object.prototype.hasOwnProperty.call(newValues, label)) {
      const value = newValues[label];
      if (typeof value === 'string' && /^\d{4}-\d{4}$/.test(value)) {
        const [startVal, endVal] = value.split('-');
        const formatTime = (v: string) => `${v.substring(0, 2)}:${v.substring(2, 4)}`;
        // TV session combobox requires character-by-character insertText to register changes
        const setSessionInput = async (input: HTMLInputElement, timeValue: string) => {
          input.focus();
          input.select();
          await delay(100);
          document.execCommand('selectAll', false, undefined);
          document.execCommand('delete', false, undefined);
          await delay(50);
          for (const char of timeValue) {
            input.dispatchEvent(
              new KeyboardEvent('keydown', { key: char, code: `Key${char.toUpperCase()}`, bubbles: true }),
            );
            document.execCommand('insertText', false, char);
            input.dispatchEvent(
              new KeyboardEvent('keyup', { key: char, code: `Key${char.toUpperCase()}`, bubbles: true }),
            );
            await delay(30);
          }
          await delay(100);
          input.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }),
          );
          await delay(50);
          input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          await delay(100);
        };
        const startInput = sessionStartContainer.querySelector('input[name="start"]') as HTMLInputElement | null;
        const endInput = sessionEndContainer.querySelector('input[name="end"]') as HTMLInputElement | null;
        if (startInput && startInput.value !== formatTime(startVal)) {
          await setSessionInput(startInput, formatTime(startVal));
        }
        if (endInput && endInput.value !== formatTime(endVal)) {
          await setSessionInput(endInput, formatTime(endVal));
        }
        appliedParams.add(label);
        i++;
        continue;
      }
    }

    const inputEl = nextCell?.querySelector(TVSelectors.SETTINGS_INPUT_ELEMENT) as HTMLElement | null;
    if (inputEl) {
      if (Object.prototype.hasOwnProperty.call(newValues, label) && !processedCheckboxes[label]) {
        const value = newValues[label];
        // Set value directly on the found input element
        if (inputEl.tagName.toLowerCase() === 'input') {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) {
            (inputEl as HTMLInputElement).focus();
            setter.call(inputEl, value);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else if (inputEl.getAttribute('role') === 'button' || inputEl.getAttribute('role') === 'combobox') {
          inputEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          inputEl.click();
          await selectDropdownOption(rawLabel, value);
        }
        appliedParams.add(label);
        i++; // Skip next cell
      }
    }
  }

  // Check for parameter mismatches (requested but not found in strategy)
  const requestedParams = Object.keys(newValues);
  const missingParams = requestedParams.filter(param => !appliedParams.has(param));

  if (missingParams.length > 0) {
    debugLog(
      'log',
      `[tv_settings] ℹ️ Parameter mismatch: ${missingParams.length} parameter(s) not found in current strategy: ${missingParams.join(', ')}`,
    );

    // Build a list showing each missing param and its saved value
    const paramLines = missingParams.map(p => `  ${p} = ${newValues[p]}`).join('\n');

    setTimeout(() => {
      alert(
        `The following saved parameters were not found in the current strategy:\n\n` +
          `${paramLines}\n\n` +
          `These values were saved but could not be applied.\n\n` +
          `Did you make changes to the strategy? If so, you can ignore this and re-save your parameters.`,
      );
    }, 500);
  }
}

/**
 * clickOkButton
 *
 * Finds and simulates a full click (mousedown, mouseup, click) on the OK/submit button in the settings dialog,
 * closing the dialog and submitting the changes.
 */
function clickOkButton(): void {
  const dialog = document.querySelector(TVSelectors.SETTINGS_DIALOG) as HTMLElement | null;
  if (!dialog) {
    debugLog('warn', '[tv_settings] Settings dialog not found.');
    return;
  }
  // Look for the OK button by its attributes.
  const okButton = dialog.querySelector(TVSelectors.SETTINGS_DIALOG_OK_BUTTON) as HTMLButtonElement | null;
  if (!okButton) {
    debugLog('warn', '[tv_settings] OK button not found.');
    return;
  }
  // Force the button to be visible.
  okButton.classList.remove(TVSelectors.STRATEGY_SETTINGS_REMOVE_BLOCK);
  okButton.style.display = 'block';
  okButton.style.opacity = '1';

  // Simulate a full click sequence.
  const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
  const mouseupEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
  const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

  okButton.dispatchEvent(mousedownEvent);
  okButton.dispatchEvent(mouseupEvent);
  okButton.dispatchEvent(clickEvent);

  //console.log('[tv_settings] OK button clicked to submit and close the settings dialog.');
}

/**
 * clickCloseButton
 *
 * Closes the settings dialog without applying changes (clicks the X button).
 */
function clickCloseButton(): void {
  const dialog = document.querySelector(TVSelectors.SETTINGS_DIALOG) as HTMLElement | null;
  if (!dialog) return;

  // Try close (X) button first, then cancel button as fallback
  const closeButton = (dialog.querySelector(TVSelectors.SETTINGS_DIALOG_CLOSE_BUTTON) ||
    dialog.querySelector('button[name="cancel"]')) as HTMLButtonElement | null;
  if (!closeButton) {
    debugLog('warn', '[tv_settings] Close button not found.');
    return;
  }

  const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
  const mouseupEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
  const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

  closeButton.dispatchEvent(mousedownEvent);
  closeButton.dispatchEvent(mouseupEvent);
  closeButton.dispatchEvent(clickEvent);
}

export const tv_settings = {
  clickStrategySettings,
  scrapeSettingsDialog,
  updateSettingsDialog,
  clickOkButton,
  clickCloseButton,
};
