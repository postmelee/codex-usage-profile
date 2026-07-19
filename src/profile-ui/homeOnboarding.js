export const HOME_SUBMIT_COMMAND = "npx codex-usage-profile@latest submit";

export const HOME_QUICKSTART_STEPS = Object.freeze([
  createStep(
    "approve-device",
    "Approve your device",
    "Open the link from the CLI and approve the device with your signed-in account."
  ),
  createStep(
    "submit-usage",
    "Submit Codex usage",
    "Let the CLI read your Codex usage and send the supported usage fields."
  ),
  createStep(
    "review-card",
    "Review your card",
    "Confirm the updated private card on the home page."
  ),
  createStep(
    "publish-card",
    "Publish your card",
    "Make the card public when it is ready to share."
  ),
  createStep(
    "copy-readme",
    "Copy README Markdown",
    "Copy the stable image link or Markdown for your GitHub README."
  )
]);

function createStep(id, title, description) {
  return Object.freeze({ description, id, title });
}
