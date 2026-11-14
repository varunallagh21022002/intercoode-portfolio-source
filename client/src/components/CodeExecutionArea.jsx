import React, { useEffect, useState, useCallback } from 'react';
import createBulkSubmission from '../api/judgeZeroApi';
import socket from '../api/sockets';

// Icon components
const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LoadingIcon = () => (
  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const CodeExecutionArea = ({ roomId, testCases, code, language, setTestCases }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState(0);
  const [id, setId] = useState(0);
  
  useEffect(() => {
    let newId;
    switch (language) {
      case "python": newId = 92; break;
      case "cpp": newId = 54; break;
      case "java": newId = 91; break;
      case "javascript": newId = 93; break;
      case "rust": newId = 73; break;
      case "php": newId = 68; break;
      case "html": newId = 42; break; // HTML doesn't have direct support, using C as placeholder
      case "css": newId = 41; break;  // CSS doesn't have direct support, using C as placeholder
      case "sql": newId = 82; break;  // Using SQLite
      case "markdown": newId = 46; break; // Markdown doesn't have direct support, using C as placeholder
      case "json": newId = 93; break; // JSON is treated as JavaScript
      default: newId = null;
    }
    setId(newId);
  }, [language]);

  // Listen for updates from the interviewer/interviewee
  useEffect(() => {
    socket.on("update-output", (updatedTestCases) => {
      setTestCases(updatedTestCases);
    });

    return () => {
      socket.off("update-output"); // Cleanup listener
    };
  }, [setTestCases]);

  const executeCode = useCallback(async () => {
    if (code.trim() === "" || !language) {
      alert("Please enter code and select a language.");
      return;
    }
    setIsExecuting(true);

    // Mark test cases as "Running..."
    setTestCases(prevTestCases => prevTestCases.map(tc => ({
      ...tc,
      status: "Running...",
      output: ""
    })));

    try {
      const response = await createBulkSubmission(id, code, testCases);

      if (response && response.length > 0) {
        const updatedTestCases = testCases.map((tc, index) => ({
          ...tc,
          output: response[index].output || "No Output",
          status: response[index].testCasePassed ? "Success" : "Failed",
          testCasePassed: response[index].testCasePassed
        }));

        // Update the local test case state
        setTestCases(updatedTestCases);

        // Emit the updated results to the room
        socket.emit("send-output", { testCases: updatedTestCases, roomId });
      }
    } catch (error) {
      console.error("Execution error:", error);
      setTestCases(prevTestCases => prevTestCases.map(tc => ({
        ...tc,
        status: "Error",
        output: "Execution failed"
      })));
    } finally {
      setIsExecuting(false);
    }
  }, [code, id, testCases, roomId, setTestCases]);

  // Add a new empty test case
  const addTestCase = () => {
    setTestCases([...testCases, { 
      input: "", 
      expectedOutput: "", 
      output: "", 
      status: "Not Executed", 
      testCasePassed: null 
    }]);
    // Focus on the new test case
    setSelectedTestCase(testCases.length);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Actions Bar */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center space-x-1">
          <button
            onClick={addTestCase}
            className="bg-zinc-800 hover:bg-zinc-700 text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors"
            title="Add new test case"
          >
            <PlusIcon />
            <span>Add Case</span>
          </button>
        </div>
        
    <button
      onClick={executeCode}
          disabled={isExecuting || !testCases.length || !language}
          className={`px-3 py-1 rounded text-xs flex items-center font-medium transition-colors
            ${isExecuting || !testCases.length || !language 
              ? "bg-zinc-700 text-zinc-400 cursor-not-allowed" 
              : "bg-gradient-to-r from-[#fb568a] to-[#e456fb] hover:opacity-90 text-white"
      }`}
    >
          {isExecuting ? <LoadingIcon /> : <PlayIcon />}
          {isExecuting ? "Running..." : "Run Tests"}
    </button>
  </div>

      {/* Test Case Area */}
      {testCases.length === 0 || (testCases.length === 1 && testCases[0]?.input.trim() === "") ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <p className="text-gray-400 text-sm mb-4">No test cases available</p>
          <button
            onClick={addTestCase}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
          >
            <PlusIcon />
            <span>Add Test Case</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Test Case Sidebar */}
          <div className="w-1/3 border-r border-zinc-800 overflow-y-auto">
            <div className="py-2 px-1">
            {testCases.map((testCase, index) => (
              <div
                key={index}
                  className={`px-3 py-2 rounded cursor-pointer transition-colors mx-1 mb-1 flex items-center justify-between
                    ${selectedTestCase === index
                      ? "bg-gradient-to-r from-[#fb568a]/20 to-[#e456fb]/20 border border-[#fb568a]/40"
                      : "hover:bg-zinc-800"
                }`}
                onClick={() => setSelectedTestCase(index)}
              >
                  <div>
                <p className="text-xs font-medium text-gray-200">Test Case {index + 1}</p>
                <p
                  className={`text-xs ${
                    testCase.status === "Success"
                      ? "text-green-400"
                      : testCase.status === "Failed"
                      ? "text-red-400"
                          : testCase.status === "Running..."
                          ? "text-blue-400"
                      : "text-gray-400"
                  }`}
                >
                  {testCase.status || "Not Executed"}
                </p>
                  </div>
                  <div 
                    className={`h-2 w-2 rounded-full ${
                      testCase.status === "Success"
                        ? "bg-green-500"
                        : testCase.status === "Failed"
                        ? "bg-red-500"
                        : testCase.status === "Running..."
                        ? "bg-blue-500 animate-pulse"
                        : "bg-gray-500"
                    }`}
                  />
              </div>
            ))}
          </div>
        </div>

        {/* Test Case Details */}
          <div className="w-2/3 flex flex-col overflow-auto">
          {testCases.length > 0 && (
              <div className="p-4 space-y-4 h-full">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-400">Input:</p>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                <p className="font-mono text-xs whitespace-pre-wrap text-gray-200">
                      {testCases[selectedTestCase]?.input || "No input"}
                </p>
              </div>
              </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-400">Expected Output:</p>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800">
                  <p className="font-mono text-xs whitespace-pre-wrap text-gray-200">
                      {testCases[selectedTestCase]?.expectedOutput || "No expected output"}
                  </p>
                  </div>
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-medium text-gray-400">Actual Output:</p>
                    {testCases[selectedTestCase]?.status && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          testCases[selectedTestCase]?.status === "Success"
                            ? "bg-green-900/50 text-green-400"
                            : testCases[selectedTestCase]?.status === "Failed"
                            ? "bg-red-900/50 text-red-400"
                            : testCases[selectedTestCase]?.status === "Running..."
                            ? "bg-blue-900/50 text-blue-400"
                            : "bg-gray-900/50 text-gray-400"
                    }`}
                  >
                    {testCases[selectedTestCase]?.status}
                      </span>
                    )}
                  </div>
                  <div className="bg-zinc-900 p-2 rounded border border-zinc-800 min-h-[100px] flex-1">
                    <p className="font-mono text-xs whitespace-pre-wrap text-gray-200">
                      {testCases[selectedTestCase]?.output || "No output"}
                    </p>
                  </div>
                </div>
                </div>
              )}
            </div>
        </div>
    )}
  </div>
  );
};

export default CodeExecutionArea;
