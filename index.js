// TradingView Skills — Master Export
// Usage: const tv = require('./index');

// Core library
const browser = require('./lib/browser');
const chartUtils = require('./lib/chart-utils');

// Chart Operations
const { changeSymbol } = require('./skills/change-symbol');
const { changeTimeframe } = require('./skills/change-timeframe');
const { getChartData } = require('./skills/get-chart-data');
const { setChartType, setPriceScale, setTimezone, exportChartData, takeScreenshot } = require('./skills/set-chart-type');

// Strategy Management
const { addStrategy } = require('./skills/add-strategy');
const { getActiveStrategy } = require('./skills/get-active-strategy');
const { getStrategyReport } = require('./skills/get-strategy-report');
const { openStrategySettings } = require('./skills/open-strategy-settings');
const { createStrategy } = require('./skills/create-strategy');
const { removeStrategy } = require('./skills/remove-strategy');
const { deleteStrategy } = require('./skills/delete-strategy');
const { renameStrategy } = require('./skills/rename-strategy');
const { saveStrategy } = require('./skills/save-strategy');
const { copyStrategySettings, pasteStrategySettings, cloneStrategy } = require('./skills/clone-strategy');

// Watchlist Operations
const { getWatchlistSymbols } = require('./skills/get-watchlist-symbols');
const { createWatchlist } = require('./skills/create-watchlist');
const { addToWatchlist } = require('./skills/add-to-watchlist');
const { deleteWatchlist } = require('./skills/delete-watchlist');

// Indicators
const { getIndicatorList, getIndicatorsFromSection, addIndicator, removeIndicator, getIndicatorSettings, setIndicatorSettings } = require('./skills/get-indicator-list');

// Alerts
const { createAlert } = require('./skills/create-alert');
const { viewAlert, listAlerts, editAlert, deleteAlert } = require('./skills/view-alert');
const { getAlertLog } = require('./skills/get-alert-log');

// Drawings & Scripts
const { getDrawingList, addDrawing, removeDrawing, setDrawingProperties } = require('./skills/get-drawing-list');
const { getSavedScripts } = require('./skills/get-saved-scripts');

// WebSocket/HTTP API Skills (no browser needed)
const { getTechnicalAnalysis } = require('./skills/get-technical-analysis');
const { searchMarket } = require('./skills/search-market');
const { getQuote } = require('./skills/get-quote');
const { getIndicatorDetails } = require('./skills/get-indicator-details');
const { getMarketInfo } = require('./skills/get-market-info');
const { replayChart } = require('./skills/replay-chart');
const { fetchMoreData } = require('./skills/fetch-more-data');
const { managePinePermissions } = require('./skills/manage-pine-permissions');
const { getUserInfo } = require('./skills/get-user-info');
const { getChartDrawings } = require('./skills/get-chart-drawings');
const { deepBacktest } = require('./skills/deep-backtest');

// Study Limits
const { getUserStudyLimits, countStudiesOnChart, checkStudyCapacity } = require('./lib/study-limits');

module.exports = {
  // Core
  ...browser,
  ...chartUtils,

  // Chart Operations
  changeSymbol,
  changeTimeframe,
  getChartData,
  setChartType,
  setPriceScale,
  setTimezone,
  exportChartData,
  takeScreenshot,

  // Strategy Management
  addStrategy,
  getActiveStrategy,
  getStrategyReport,
  openStrategySettings,
  createStrategy,
  removeStrategy,
  deleteStrategy,
  renameStrategy,
  saveStrategy,
  copyStrategySettings,
  pasteStrategySettings,
  cloneStrategy,

  // Watchlist Operations
  getWatchlistSymbols,
  createWatchlist,
  addToWatchlist,
  deleteWatchlist,

  // Indicators
  getIndicatorList,
  getIndicatorsFromSection,
  addIndicator,
  removeIndicator,
  getIndicatorSettings,
  setIndicatorSettings,

  // Alerts
  createAlert,
  viewAlert,
  listAlerts,
  editAlert,
  deleteAlert,
  getAlertLog,

  // Drawings & Scripts
  getDrawingList,
  addDrawing,
  removeDrawing,
  setDrawingProperties,
  getSavedScripts,

  // WebSocket/HTTP API Skills
  getTechnicalAnalysis,
  searchMarket,
  getQuote,
  getIndicatorDetails,
  getMarketInfo,
  replayChart,
  fetchMoreData,
  managePinePermissions,
  getUserInfo,
  getChartDrawings,
  deepBacktest,

  // Study Limits
  getUserStudyLimits,
  countStudiesOnChart,
  checkStudyCapacity,
};
