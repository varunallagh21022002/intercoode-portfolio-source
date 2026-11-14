import React, { useEffect, useRef, useState } from 'react';

const CodePreview = ({ code, language }) => {
  const iframeRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    
    // Generate the HTML content for the preview
    let htmlContent = '';
    
    try {
      if (language === 'javascript') {
        // For JavaScript, create a basic HTML with a console output area
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              html, body {
                height: 100%;
                margin: 0;
                padding: 0;
                overflow: auto;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                padding: 10px;
                color: white;
                background-color: #111623;
                box-sizing: border-box;
              }
              .output {
                background-color: #0c1018;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 10px;
                margin-top: 10px;
                font-family: monospace;
                white-space: pre-wrap;
                overflow-y: auto;
                max-height: 70vh;
              }
              .console-item {
                margin: 2px 0;
                padding: 4px;
                border-bottom: 1px solid #2d2d2d;
              }
              .console-log {
                color: #ffffff;
              }
              .console-error {
                color: #ff5c5c;
              }
              .console-warn {
                color: #ffb638;
              }
              .console-info {
                color: #5c9eff;
              }
              h3 {
                margin-top: 0;
                color: #e456fb;
              }
            </style>
          </head>
          <body>
            <h3>JavaScript Preview</h3>
            <p>Output:</p>
            <div id="output" class="output"></div>
            <script>
              const outputEl = document.getElementById('output');
              
              // Override console methods
              const originalConsole = {
                log: console.log,
                error: console.error,
                warn: console.warn,
                info: console.info
              };
              
              console.log = function(...args) {
                originalConsole.log(...args);
                const item = document.createElement('div');
                item.className = 'console-item console-log';
                item.textContent = args.map(arg => 
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                outputEl.appendChild(item);
                outputEl.scrollTop = outputEl.scrollHeight;
              };
              
              console.error = function(...args) {
                originalConsole.error(...args);
                const item = document.createElement('div');
                item.className = 'console-item console-error';
                item.textContent = args.map(arg => 
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                outputEl.appendChild(item);
                outputEl.scrollTop = outputEl.scrollHeight;
              };
              
              console.warn = function(...args) {
                originalConsole.warn(...args);
                const item = document.createElement('div');
                item.className = 'console-item console-warn';
                item.textContent = args.map(arg => 
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                outputEl.appendChild(item);
                outputEl.scrollTop = outputEl.scrollHeight;
              };
              
              console.info = function(...args) {
                originalConsole.info(...args);
                const item = document.createElement('div');
                item.className = 'console-item console-info';
                item.textContent = args.map(arg => 
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');
                outputEl.appendChild(item);
                outputEl.scrollTop = outputEl.scrollHeight;
              };
              
              try {
                ${code || '// No JavaScript code entered'}
              } catch (error) {
                console.error('Error:', error.message);
              }
            </script>
          </body>
          </html>
        `;
      } else if (language === 'html' || !language || language === '') {
        // For HTML, use the provided code with fallback
        if (code) {
          // If user code doesn't have basic HTML structure, add it
          if (!code.includes('<html') && !code.includes('<!DOCTYPE')) {
            htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
              </head>
              <body style="overflow: auto;">
                ${code}
              </body>
              </html>
            `;
          } else {
            htmlContent = code;
          }
        } else {
          htmlContent = '<!DOCTYPE html><html><body style="overflow: auto;"><p>Enter HTML code to see preview</p></body></html>';
        }
      } else if (language === 'python' || language === 'java' || language === 'cpp') {
        // For other languages, show a message
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              html, body {
                height: 100%;
                margin: 0;
                padding: 0;
                overflow: auto;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                padding: 20px;
                color: white;
                background-color: #111623;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                text-align: center;
                box-sizing: border-box;
              }
              svg {
                width: 40px;
                height: 40px;
                margin-bottom: 15px;
                fill: #e456fb;
              }
              h3 {
                color: #e456fb;
                margin: 0 0 10px 0;
              }
            </style>
          </head>
          <body>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3>${language.toUpperCase()} Preview Unavailable</h3>
            <p>Live preview is only available for HTML and JavaScript.</p>
            <p>Run your code using the Code Execution panel below.</p>
          </body>
          </html>
        `;
      }
    } catch (e) {
      console.error("Error generating HTML content:", e);
      setError("Error generating preview content");
      setIsLoading(false);
      return;
    }

    // Use a timeout to ensure the component is fully rendered
    setTimeout(() => {
      setIsLoading(false);
    }, 300);

  }, [code, language]);

  // Create a simple preview component that doesn't rely on iframe manipulation
  // Instead, use the iframe's srcdoc attribute which is more reliable
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800 shrink-0">
        <span className="font-medium text-sm">Code Preview</span>
        <div className="flex items-center space-x-1">
          {error && (
            <div className="text-xs text-red-400">Error: {error}</div>
          )}
        </div>
      </div>
      <div className="flex-1 bg-[#111623] relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-white text-sm bg-black/50 px-4 py-2 rounded">Loading preview...</div>
          </div>
        )}
        
        {language === 'html' || !language || language === '' ? (
          <iframe
            title="HTML Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={code || '<p>Enter HTML code to see preview</p>'}
            onLoad={() => setIsLoading(false)}
          />
        ) : language === 'javascript' ? (
          <iframe
            title="JavaScript Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body { 
                    font-family: sans-serif; 
                    color: white; 
                    background-color: #111623; 
                    padding: 10px;
                    overflow: auto;
                  }
                  .output {
                    background-color: #0c1018;
                    border: 1px solid #333;
                    border-radius: 4px;
                    padding: 10px;
                    margin-top: 10px;
                    font-family: monospace;
                    white-space: pre-wrap;
                    overflow-y: auto;
                    max-height: 70vh;
                  }
                  .console-item {
                    margin: 2px 0;
                    padding: 4px;
                    border-bottom: 1px solid #2d2d2d;
                  }
                  .console-log { color: #ffffff; }
                  .console-error { color: #ff5c5c; }
                  .console-warn { color: #ffb638; }
                  .console-info { color: #5c9eff; }
                  h3 { color: #e456fb; margin-top: 0; }
                </style>
              </head>
              <body>
                <h3>JavaScript Preview</h3>
                <p>Output:</p>
                <div id="output" class="output"></div>
                <script>
                  const outputEl = document.getElementById('output');
                  
                  // Override console methods
                  console.log = function(...args) {
                    const item = document.createElement('div');
                    item.className = 'console-item console-log';
                    item.textContent = args.map(arg => 
                      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                    ).join(' ');
                    outputEl.appendChild(item);
                    outputEl.scrollTop = outputEl.scrollHeight;
                  };
                  
                  console.error = function(...args) {
                    const item = document.createElement('div');
                    item.className = 'console-item console-error';
                    item.textContent = args.map(arg => 
                      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                    ).join(' ');
                    outputEl.appendChild(item);
                    outputEl.scrollTop = outputEl.scrollHeight;
                  };
                  
                  console.warn = function(...args) {
                    const item = document.createElement('div');
                    item.className = 'console-item console-warn';
                    item.textContent = args.map(arg => 
                      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                    ).join(' ');
                    outputEl.appendChild(item);
                    outputEl.scrollTop = outputEl.scrollHeight;
                  };
                  
                  console.info = function(...args) {
                    const item = document.createElement('div');
                    item.className = 'console-item console-info';
                    item.textContent = args.map(arg => 
                      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                    ).join(' ');
                    outputEl.appendChild(item);
                    outputEl.scrollTop = outputEl.scrollHeight;
                  };
                  
                  try {
                    ${code || '// No JavaScript code entered'}
                  } catch (error) {
                    console.error('Error:', error.message);
                  }
                </script>
              </body>
              </html>
            `}
            onLoad={() => setIsLoading(false)}
          />
        ) : (
          <iframe
            title="Language Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body {
                    font-family: sans-serif;
                    color: white;
                    background-color: #111623;
                    padding: 20px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    box-sizing: border-box;
                  }
                  svg {
                    width: 40px;
                    height: 40px;
                    margin-bottom: 15px;
                    fill: #e456fb;
                  }
                  h3 {
                    color: #e456fb;
                    margin: 0 0 10px 0;
                  }
                </style>
              </head>
              <body>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>${language.toUpperCase()} Preview Unavailable</h3>
                <p>Live preview is only available for HTML and JavaScript.</p>
                <p>Run your code using the Code Execution panel below.</p>
              </body>
              </html>
            `}
            onLoad={() => setIsLoading(false)}
          />
        )}
      </div>
    </div>
  );
};

export default CodePreview; 