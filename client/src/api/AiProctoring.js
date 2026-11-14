import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import socket from "./sockets";

let lastVideoTime = -1;
let alertCooldowns = {};
let running = true;

const BUFFER_SIZE = 6;
const ANGLE_THRESHOLD_LEFT = 110;
const ANGLE_THRESHOLD_RIGHT = 133;


const CENTER_SHIFT_THRESHOLD_RIGHT = 420;
const CENTER_SHIFT_THRESHOLD_LEFT = 200;

let eyeAngleBuffer = [];
let faceCenterBuffer = [];

function shouldSendAlert(type) {
  const now = Date.now();
  if (!alertCooldowns[type] || now - alertCooldowns[type] > 5000) {
    alertCooldowns[type] = now;
    // console.log(`[ALERT] Sending "${type}" alert.`);
    return true;
  }
  // console.log(`[ALERT] Skipped "${type}" alert due to cooldown.`);
  return false;
}

function movingAverage(buffer) {
  const sum = buffer.reduce((acc, val) => acc + val, 0);
  return sum / buffer.length;
}

const AiProctoring = async (videoElement, roomId, canvas = null) => {
  console.log("[INIT] AI Proctoring started.");
  let faceDetector = null;
  let stopFunction = null;

  try {
    console.log("[INIT] Loading MediaPipe vision tasks...");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

    console.log("[INIT] Creating face detector...");
    faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
    },
    runningMode: "VIDEO"
  });
    console.log("[INIT] Face detector created successfully");
  } catch (error) {
    console.error("[ERROR] Failed to initialize AI proctoring:", error);
    running = false;
    return {
      stop: () => {
        console.log("[STOP] AI Proctoring never started due to initialization error.");
      }
    };
  }

  let ctx = null;
  if (canvas) ctx = canvas.getContext("2d");
  
  // Reset buffers
  eyeAngleBuffer = [];
  faceCenterBuffer = [];
  alertCooldowns = {};
  running = true;

  const predict = async () => {
    if (!running) return;

    if (!videoElement || videoElement.paused || videoElement.ended) {
      if (running) requestAnimationFrame(predict);
      return;
    }

    try {
    const now = performance.now();
    if (videoElement.currentTime !== lastVideoTime) {
      lastVideoTime = videoElement.currentTime;

      const width = videoElement.videoWidth;
      const height = videoElement.videoHeight;

        if (canvas && ctx) {
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
      }

      let detections = [];
      try {
          if (!faceDetector) throw new Error("Face detector not initialized");
        const result = faceDetector.detectForVideo(videoElement, now);
        detections = result?.detections || [];
      } catch (err) {
        console.error("[ERROR] Face detection failed:", err);
          if (running) requestAnimationFrame(predict);
        return;
      }

      if (detections.length === 0) {
        if (shouldSendAlert("no-face")) {
          socket.emit("alert", {
            message: "No face detected",
            type: "no-face",
            roomId
          });
        }
      } else if (detections.length > 1) {
        if (shouldSendAlert("multiple-faces")) {
          socket.emit("alert", {
            message: "Multiple faces detected",
            type: "multiple-faces",
            roomId
          });
        }
      } else {
        const detection = detections[0];
        const { boundingBox: bbox, keypoints } = detection;

          if (canvas && ctx) {
          ctx.strokeStyle = "red";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            bbox.originX * width,
            bbox.originY * height,
            bbox.width * width,
            bbox.height * height
          );

          keypoints.forEach((point) => {
            ctx.fillStyle = "blue";
            ctx.beginPath();
            ctx.arc(point.x * width, point.y * height, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
        }

          // Ensure keypoints are valid before calculating angle
          if (keypoints && keypoints.length >= 3) {
        const leftEye = keypoints[1];
        const rightEye = keypoints[2];
            
            if (leftEye && rightEye) {
        const dx = rightEye.x - leftEye.x;
        const dy = rightEye.y - leftEye.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        eyeAngleBuffer.push(angle);
        if (eyeAngleBuffer.length > BUFFER_SIZE) eyeAngleBuffer.shift();
        const avgEyeAngle = movingAverage(eyeAngleBuffer);

        const faceCenterX = bbox.originX + bbox.width / 2;
        faceCenterBuffer.push(faceCenterX);
        if (faceCenterBuffer.length > BUFFER_SIZE) faceCenterBuffer.shift();
        const avgFaceCenterX = movingAverage(faceCenterBuffer);

        const isLookingAway =
              (Math.abs(avgEyeAngle) >= ANGLE_THRESHOLD_RIGHT || Math.abs(avgEyeAngle) <= ANGLE_THRESHOLD_LEFT) ||
              (Math.abs(avgFaceCenterX) > CENTER_SHIFT_THRESHOLD_RIGHT || Math.abs(avgFaceCenterX) < CENTER_SHIFT_THRESHOLD_LEFT);

        const faceArea = bbox.width * bbox.height;
              
        if (isLookingAway) {
          if (shouldSendAlert("head-turn")) {
            socket.emit("alert", {
              message: "Interviewee might be looking away",
              type: "head-turn",
              roomId
            });
          }
        } else if (faceArea < 0.05) {
          if (shouldSendAlert("face-too-small")) {
            socket.emit("alert", {
              message: "User might be too far from the camera",
              type: "face-too-small",
              roomId
            });
          }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("[ERROR] Error in AI proctoring loop:", err);
    }

    if (running) {
      // Use RAF with try-catch for robustness
      try {
    requestAnimationFrame(predict);
      } catch (e) {
        console.error("[ERROR] Failed to schedule next frame:", e);
        setTimeout(predict, 100); // Fallback to setTimeout
      }
    }
  };

  // Start the prediction loop
  try {
  predict();
  } catch (error) {
    console.error("[ERROR] Failed to start prediction loop:", error);
    running = false;
  }

  // Return stop function
  stopFunction = () => {
    running = false;
    
    // Clear references and state
    faceDetector = null;
    lastVideoTime = -1;
    eyeAngleBuffer = [];
    faceCenterBuffer = [];
    alertCooldowns = {};
    
    console.log("[STOP] AI Proctoring stopped.");
  };

  return {
    stop: stopFunction
  };
};

export default AiProctoring;
