const editor = document.querySelector("#code-editor");
const status = document.querySelector("#editor-status");
const resetButton = document.querySelector("#reset-button");
const previewButton = document.querySelector("#preview-button");
const initialCode = editor.value;

resetButton.addEventListener("click", () => {
  editor.value = initialCode;
  status.textContent = "Example restored — nothing was sent anywhere.";
});

previewButton.addEventListener("click", () => {
  status.textContent = `Local preview acknowledged ${editor.value.length} characters. No code was executed.`;
});
