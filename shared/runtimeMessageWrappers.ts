/**
 * debugSendMessage
 *
 * A wrapper for chrome.runtime.sendMessage that logs the arguments and a stack trace.
 *
 * @param message - The message object to send.
 * @param options - Optional options.
 * @returns A Promise that resolves with the response.
 */
export function debugSendMessage<T = any>(message: any, options?: any): Promise<T> {
  console.log('chrome.runtime.sendMessage triggered with:', message, options, new Error().stack);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, options, response => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        reject(chrome.runtime.lastError);
      } else {
        resolve(response as T);
      }
    });
  });
}
