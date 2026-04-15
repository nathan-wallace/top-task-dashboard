import { buildPrompt } from './lib/prompt.js';

async function copyPromptToClipboard(promptOutput, copyStatus) {
  const text = promptOutput.value.trim();
  if (!text) {
    copyStatus.textContent = 'Please complete the form first.';
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = 'Prompt copied.';
  } catch {
    copyStatus.textContent = 'Copy failed. Select and copy manually.';
  }
}

function initPromptPage() {
  const promptForm = document.querySelector('#prompt-form');
  const promptOutput = document.querySelector('#prompt-output');
  const copyPromptButton = document.querySelector('#copy-prompt');
  const copyStatus = document.querySelector('#copy-status');
  if (!promptForm || !promptOutput || !copyPromptButton || !copyStatus) return;

  const updatePromptOutput = () => {
    const formData = new FormData(promptForm);
    const values = Object.fromEntries(formData.entries());
    promptOutput.value = buildPrompt(values);
  };

  promptForm.addEventListener('input', updatePromptOutput);
  copyPromptButton.addEventListener('click', () => copyPromptToClipboard(promptOutput, copyStatus));
  updatePromptOutput();
}

initPromptPage();
