import { execFile } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline/promises";

const GH_COMMAND_TIMEOUT_MS = 5_000;
const GH_COMMAND_MAX_BUFFER_BYTES = 16 * 1_024;
const GITHUB_REPOSITORY = "postmelee/codex-usage-profile";
const STAR_ENDPOINT = `/user/starred/${GITHUB_REPOSITORY}`;

const ACTIVE_ACCOUNT_ARGS = Object.freeze([
  "api",
  "user",
  "--jq",
  ".login"
]);
const STAR_STATUS_ARGS = Object.freeze([
  "api",
  "--silent",
  "--method",
  "GET",
  STAR_ENDPOINT
]);
const STAR_REPOSITORY_ARGS = Object.freeze([
  "api",
  "--silent",
  "--method",
  "PUT",
  STAR_ENDPOINT
]);

export async function maybePromptGithubStar(options = {}) {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const env = options.env ?? process.env;

  if (
    options.json === true ||
    isCiEnvironment(env) ||
    stdin?.isTTY !== true ||
    stdout?.isTTY !== true
  ) {
    return false;
  }

  const runGh = options.runGh ?? createGhRunner();
  const prompt = options.prompt ?? promptForAnswer;

  try {
    const accountResult = await runGh(ACTIVE_ACCOUNT_ARGS);
    const login = accountResult?.ok === true
      ? normalizeGithubLogin(accountResult.stdout)
      : null;
    if (!login) return false;

    const statusResult = await runGh(STAR_STATUS_ARGS);
    if (statusResult?.ok === true) return false;
    if (statusResult?.statusCode !== 404) return false;

    const message = `Star ${GITHUB_REPOSITORY} on GitHub as @${login}? (Y/n) `;
    while (true) {
      const answer = normalizeAnswer(await prompt({ stdin, stdout, message }));
      if (answer === "cancel") return false;
      if (answer === "no") return false;
      if (answer === "invalid") {
        stdout.write("Please answer y or n.\n");
        continue;
      }

      const starResult = await runGh(STAR_REPOSITORY_ARGS);
      if (starResult?.ok !== true) {
        stdout.write("Could not star the GitHub repository. Continuing.\n");
        return false;
      }
      stdout.write(`Starred ${GITHUB_REPOSITORY} as @${login}.\n`);
      return true;
    }
  } catch {
    return false;
  }
}

export function createGhRunner(options = {}) {
  const execFileImpl = options.execFileImpl ?? execFile;

  return async function runGh(args) {
    try {
      return await new Promise((resolve) => {
        execFileImpl("gh", [...args], {
          encoding: "utf8",
          maxBuffer: GH_COMMAND_MAX_BUFFER_BYTES,
          timeout: GH_COMMAND_TIMEOUT_MS,
          windowsHide: true
        }, (error, stdout, stderr) => {
          if (error) {
            resolve({
              ok: false,
              statusCode: readHttpStatus(
                typeof stderr === "string" ? stderr : error?.stderr
              )
            });
            return;
          }
          resolve({
            ok: true,
            stdout: typeof stdout === "string" ? stdout : ""
          });
        });
      });
    } catch {
      return { ok: false, statusCode: null };
    }
  };
}

async function promptForAnswer({ stdin, stdout, message }) {
  const readline = createInterface({
    input: stdin,
    output: stdout,
    terminal: true
  });
  const closed = once(readline, "close").then(() => null);
  try {
    return await Promise.race([
      readline.question(message),
      closed
    ]);
  } finally {
    readline.close();
  }
}

function normalizeGithubLogin(value) {
  if (typeof value !== "string") return null;
  const login = value.trim();
  if (login.length === 0 || login.length > 39) return null;
  return /^[A-Za-z0-9-]+$/.test(login) ? login : null;
}

function normalizeAnswer(value) {
  if (typeof value !== "string") return "cancel";
  const answer = value.trim().toLowerCase();
  if (answer === "" || answer === "y" || answer === "yes") return "yes";
  if (answer === "n" || answer === "no") return "no";
  return "invalid";
}

function isCiEnvironment(env) {
  if (!env || typeof env.CI !== "string") return false;
  const value = env.CI.trim().toLowerCase();
  return value !== "" && value !== "0" && value !== "false";
}

function readHttpStatus(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/\bHTTP\s+(\d{3})\b/i);
  return match ? Number.parseInt(match[1], 10) : null;
}
