import { useState, useEffect } from "react";
import socket from "../api/sockets"; // Import the socket instance

const IntervieweeQuestion = ({ testCases, setTestCases }) => {
  const [receivedQuestion, setReceivedQuestion] = useState(null);

  // Listen for question from interviewer
  useEffect(() => {
    console.log("[IntervieweeQuestion] Setting up socket listeners");

    // Listen for question sent by interviewer
    socket.on("receive-question", ({ question, testCases }) => {
      console.log("[IntervieweeQuestion] Received question:", question);
      setReceivedQuestion(question);
      setTestCases(testCases);
    });

    // Listen for question deletion by interviewer
    socket.on("receive-delete-question", () => {
      console.log("[IntervieweeQuestion] Question deleted by interviewer");
      setReceivedQuestion("");
      setTestCases([{ input: "", expectedOutput: "", output: "", status: "Not Executed", testCasePassed: null }]); // Clear test cases
    });

    return () => {
      // Clean up all socket listeners
      socket.off("receive-question"); 
      socket.off("receive-delete-question");
      console.log("[IntervieweeQuestion] Socket listeners cleaned up");
    };
  }, [setTestCases]);

  return (
    <div className="bg-zinc-800 text-white p-4 rounded-lg shadow-md mt-4 w-full">
      <h2 className="font-bold mb-2">Question</h2>
      {receivedQuestion ? (
        <div className="bg-zinc-700 p-3 rounded-lg">
          <p className="mb-2 whitespace-pre-wrap">{receivedQuestion}</p>
        </div>
      ) : (
        <p className="text-gray-400">Waiting for the interviewer to send a question...</p>
      )}
    </div>
  );
};

export default IntervieweeQuestion;