// import * as prettier from 'prettier';
const { window } = require("vscode");

// type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';

const outputChannel = window.createOutputChannel("Image Hover Preview");

function line() {
  outputChannel.appendLine("\n");
}

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "NONE";
/**
 *
 * @param {string} message
 * @param {'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE'} logLevel
 */
function logMessage(message: string, logLevel: LogLevel) {
  const cur = new Date().toLocaleTimeString();
  outputChannel.appendLine(`["${logLevel}" - ${cur}] ${message}`);
}
function logObj(data: object) {
  const message = JSON.stringify(data, null, 2).trim();
  outputChannel.appendLine(message);
}

function log(message: object | string) {
  if (typeof message === "object") {
    logObj(message);
    return;
  }
  logMessage(message, "INFO");
}

function error(error: Error) {
  logMessage(error.message, "ERROR");
  // logObj(error.stack);
}

export default {
  log,
  error,
  enter: line,
};
