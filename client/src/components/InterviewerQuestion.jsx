import { useState, useEffect } from "react";
import socket from "../api/sockets"; // Importing socket instance

const InterviewerQuestion = ({ roomId, testCases, setTestCases, onQuestionChange }) => {
  const [question, setQuestion] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [questionSent, setQuestionSent] = useState(false);

  // Socket listener for proctoring alerts
  useEffect(() => {
    socket.on("alert", ({ message, type }) => {
      setAlerts((prev) => [
        {
          message,
          type,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    });

    return () => {
      socket.off("alert");
    };
  }, []);

  // Update question and notify parent
  const updateQuestion = (newQuestion) => {
    setQuestion(newQuestion);
    setQuestionSent(false);
    if (onQuestionChange) {
      onQuestionChange(newQuestion);
    }
  };

  // Update test case values
  const updateTestCase = (index, field, value) => {
    const newTestCases = [...testCases];
    newTestCases[index][field] = value;
    setTestCases(newTestCases);
  };

  // Add a new test case
  const addTestCase = () => {
    setTestCases([
      ...testCases,
      {
        input: "",
        expectedOutput: "",
        output: "",
        status: "Not Executed",
        testCasePassed: null,
      },
    ]);
  };

  // Remove a test case
  const removeTestCase = (index) => {
    if (testCases.length > 1) {
      setTestCases(testCases.filter((_, i) => i !== index));
    } else {
      alert("At least one test case is required.");
    }
  };

  // Send question to interviewee
  const sendQuestion = () => {
    if (question.trim()) {
      const resetTestCases = testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        output: "",
        status: "Not Executed",
        testCasePassed: null,
      }));

      setTestCases(resetTestCases);
      
      console.log(`[InterviewerQuestion] Sending question to room ${roomId}:`, question);
      socket.emit("send-question", { question, testCases: resetTestCases, roomId });
      
      if (onQuestionChange) {
        onQuestionChange(question);
      }
      
      setQuestionSent(true);

      alert("Question sent to the interviewee!");
    }
  };

  // Delete question
  const deleteQuestion = () => {
    setQuestion("");
    setQuestionSent(false);
    setTestCases([
      {
        input: "",
        expectedOutput: "",
        output: "",
        status: "Not Executed",
        testCasePassed: null,
      },
    ]);

    console.log(`[InterviewerQuestion] Deleting question in room ${roomId}`);
    socket.emit("delete-question", { roomId });
    
    if (onQuestionChange) {
      onQuestionChange("");
    }
  };

  return (
    <div className="bg-zinc-800 text-white p-4 rounded-lg shadow-md w-full h-full flex flex-col">
      {/* Split into two columns */}
      <div className="flex flex-1 gap-4 overflow-auto">
        {/* Left Column: Question Editor and Test Cases */}
        <div className="flex-1 flex flex-col overflow-auto">
          <h2 className="font-bold mb-2">Set Question</h2>
          <textarea
            className="w-full p-2 rounded bg-zinc-700 border border-zinc-600 text-white font-mono min-h-[150px]"
            placeholder="Enter your question..."
            value={question}
            onChange={(e) => updateQuestion(e.target.value)}
            spellCheck={false}
          />
          
          <div className="border-t border-zinc-700 my-4"></div>
    
          <h3 className="font-semibold mt-4">Test Cases</h3>
          <div className="overflow-y-auto max-h-[200px]">
            {testCases.map((testCase, index) => (
              <div key={index} className="flex gap-2 items-center mt-2">
                <input
                  type="text"
                  className="p-2 rounded bg-zinc-700 border border-zinc-600 text-white w-1/3"
                  placeholder="Input"
                  value={testCase.input}
                  onChange={(e) => updateTestCase(index, "input", e.target.value)}
                />
                <input
                  type="text"
                  className="p-2 rounded bg-zinc-700 border border-zinc-600 text-white w-1/3"
                  placeholder="Expected Output"
                  value={testCase.expectedOutput}
                  onChange={(e) => updateTestCase(index, "expectedOutput", e.target.value)}
                />
                <button
                  onClick={() => removeTestCase(index)}
                  className="bg-red-700 text-white p-2 rounded hover:bg-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
      
          <div className="mt-4 flex gap-2">
            <button onClick={addTestCase} className="bg-zinc-600 text-white p-2 rounded hover:bg-zinc-500">
              Add Test Case
            </button>
            <button onClick={sendQuestion} className="bg-purple-700 text-white p-2 rounded hover:bg-purple-600">
              Send Question
            </button>
            <button onClick={deleteQuestion} className="bg-red-700 text-white p-2 rounded hover:bg-red-800">
              Delete Question
            </button>
          </div>
        </div>
        
        {/* Right Column: Interviewee View Preview */}
        <div className="flex-1 flex flex-col overflow-auto">
          <h3 className="font-semibold mb-2 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Interviewee View Preview</span>
            {questionSent ? (
              <span className="ml-2 text-xs bg-green-700 text-white px-2 py-0.5 rounded">Question has been sent</span>
            ) : (
              <span className="ml-2 text-xs bg-yellow-700 text-white px-2 py-0.5 rounded">Not sent yet</span>
            )}
          </h3>
          <div className="border border-dashed border-blue-500 rounded-lg p-3 bg-blue-900/10 h-full">
            <div className="bg-zinc-900 text-white p-4 rounded-lg shadow-md">
              <h2 className="font-bold mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Question
              </h2>
              {question ? (
                <div className="bg-zinc-800 p-3 rounded-lg max-h-[calc(100vh-350px)] overflow-y-auto">
                  <p className="mb-2 whitespace-pre-wrap">{question}</p>
                  {!questionSent && (
                    <div className="mt-2 text-yellow-400 text-xs italic border-t border-zinc-700 pt-2">
                      Note: This is only a preview. The interviewee won't see this until you click "Send Question".
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">Waiting for the interviewer to send a question...</p>
              )}
            </div>
          </div>
        </div>
      </div>
  
      {/* Bottom Section: AI Proctoring Alerts */}
      <h3 className="text-red-400 font-bold mb-2 mt-4">AI Proctoring Alerts</h3>
      {alerts.length > 0 ? (
        <div className="overflow-y-auto max-h-[120px]">
          <div className="space-y-2 pr-1">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className="bg-red-900/30 border border-red-400 text-red-300 p-2 rounded text-sm flex justify-between"
              >
                <span>{alert.message}</span>
                <span className="text-xs text-zinc-400">{alert.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-zinc-500 text-sm">No alerts received yet</p>
      )}
    </div>
  );
};

export default InterviewerQuestion;
