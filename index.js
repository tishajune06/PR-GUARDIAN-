require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const { Octokit } = require("octokit");
const { GoogleGenAI } = require("@google/genai");

if (!process.env.GITHUB_TOKEN) {
  console.log("⚠️ GITHUB_TOKEN missing in .env");
}
if (!process.env.GEMINI_API_KEY) {
  console.log("⚠️ GEMINI_API_KEY missing in .env");
}
if (!process.env.GITHUB_WEBHOOK_SECRET) {
  console.log("⚠️ GITHUB_WEBHOOK_SECRET missing in .env");
}
console.log("PR Guardian test");
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});
console.log("Chunking test");
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

async function testGitHub() {
  try {
    const { data } = await octokit.request("GET /user");
    console.log("GitHub Connected ✅");
    console.log("Username:", data.login);
  } catch (error) {
    console.log("GitHub Connection Failed ❌");
    console.log(error.message);
  }
}

testGitHub();
function splitDiffIntoChunks(diff, maxSize) {
  const chunks = [];

  for (let i = 0; i < diff.length; i += maxSize) {
    chunks.push(diff.slice(i, i + maxSize));
  }

  return chunks;
}
async function reviewWithGemini(diff) {
    const MAX_DIFF_SIZE = 12000;
    const chunks = splitDiffIntoChunks(diff, MAX_DIFF_SIZE);

console.log("Total diff chunks:", chunks.length);
    if (diff.length > MAX_DIFF_SIZE) {
  console.log("⚠️ PR diff is too large. It needs to be split into smaller chunks.");
}
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = `
You are an expert software engineer performing a code review.

Review the following GitHub pull request diff.

Your job is to identify only REAL and meaningful issues.

Focus on:
- Bugs
- Incorrect logic
- Security vulnerabilities
- Performance problems
- Reliability problems

Do NOT report:
- Personal coding style preferences
- Formatting issues
- Naming preferences
- Minor refactoring suggestions
- Nitpicks

Return ONLY valid JSON.

Use exactly this structure:

{
  "issues": [
    {
      "severity": "low | medium | high | critical",
      "file": "filename",
      "message": "description of the issue",
      "suggestion": "how to fix it"
    }
  ],
  "suggestions": []
}

If there are no real issues, return:

{
  "issues": [],
  "suggestions": []
}

Here is the PR diff:

${chunks[0]} 
`;

      console.log(`Sending review request to Gemini... Attempt ${attempt}/${maxRetries}`);

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt
      });

      const reviewText = response.text;

      const cleanedText = reviewText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const review = JSON.parse(cleanedText);

      console.log("Gemini Review Successful ✅");

      return review;

    } catch (error) {
      console.log(`Gemini attempt ${attempt} failed ❌`);
      console.log(error.message);

      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.log("Gemini failed after all retries ❌");
        return null;
      }
    }
  }
}

function formatReviewAsMarkdown(review) {
  if (!review || !review.issues || review.issues.length === 0) {
    return "✅ No issues found. Looks good!";
  }

  const severityEmoji = {
    low: "🔵",
    medium: "🟡",
    high: "🟠",
    critical: "🔴"
  };

  return review.issues
    .map(issue => {
      const emoji = severityEmoji[issue.severity] || "⚪";
      return `### ${emoji} ${issue.severity.toUpperCase()} — \`${issue.file}\`
**Issue:** ${issue.message}

**Suggestion:** ${issue.suggestion}
`;
    })
    .join("\n---\n");
}

async function postReviewComment(owner, repo, pullNumber, review) {
  try {
    const formatted = formatReviewAsMarkdown(review);

    const comment = `## 🤖 PR Guardian Review

${formatted}

---

*Review generated automatically by Gemini.*`;

    const response = await octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: owner,
        repo: repo,
        issue_number: pullNumber,
        body: comment
      }
    );

    console.log("Review posted to GitHub PR ✅");
    console.log("Comment ID:", response.data.id);

  } catch (error) {
    console.log("Failed to post review ❌");
    console.log("Status:", error.status);
    console.log("Message:", error.message);
  }
}

async function getPullRequestFiles(owner, repo, pullNumber) {
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
      {
        owner: owner,
        repo: repo,
        pull_number: pullNumber
      }
    );

    const allowedExtensions = [
      ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".cs", ".go"
    ];

    const filteredFiles = data.filter(file =>
      allowedExtensions.some(extension => file.filename.endsWith(extension))
    );

    const reviewFiles = filteredFiles.map(file => ({
      filename: file.filename,
      status: file.status,
      patch: file.patch
    }));

    console.log("Review Files:");
    reviewFiles.forEach(file => {
      console.log("--------------------");
      console.log("File:", file.filename);
      console.log("Status:", file.status);
      console.log("Patch:");
      console.log(file.patch || "No patch available");
    });

    const diff = reviewFiles
      .map(file => `
File: ${file.filename}
Status: ${file.status}

${file.patch || "No patch available"}
`)
      .join("\n");

    const review = await reviewWithGemini(diff);

    console.log("AI Review:");

    if (review) {
      console.log(JSON.stringify(review, null, 2));
      await postReviewComment(owner, repo, pullNumber, review);
    } else {
      console.log("Skipping comment post — review generation failed.");
    }

  } catch (error) {
    console.log("Failed to fetch PR files ❌");
    console.log(error.message);
  }
}

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
console.log("Webhook secret loaded:", !!WEBHOOK_SECRET);

const app = express();

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

function verifyGitHubSignature(req, res, next) {
  console.log("Inside Signature Middleware");

  const signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    return res.status(403).send("Missing GitHub Signature");
  }

  const expectedSignature =
    "sha256=" +
    crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedSignatureBuffer.length) {
    return res.status(403).send("Invalid Signature");
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
    return res.status(403).send("Invalid Signature");
  }

  console.log("Signature Verified ✅");
  next();
}

app.post("/test", (req, res) => {
  console.log("RAW:");
  console.log(req.rawBody.toString());
  console.log("JSON:");
  console.log(req.body);
  res.send("ok");
});

app.get("/", (req, res) => {
  res.send("PR Guardian is alive");
});

app.post("/webhook", verifyGitHubSignature, async (req, res) => {
  const event = req.headers["x-github-event"];

  console.log("Event:", event);

  if (event !== "pull_request") {
    return res.status(200).send("Ignored event");
  }

  const action = req.body.action;

  console.log("Action:", action);

  if (!["opened", "reopened", "synchronize"].includes(action)) {
    return res.status(200).send("Ignored PR action");
  }

  const owner = req.body.repository.owner.login;
  const repo = req.body.repository.name;
  const pullNumber = req.body.pull_request.number;

  console.log(
    `PR #${pullNumber} ${action} in repo ${owner}/${repo}`
  );

  res.status(200).send("Webhook received");

  getPullRequestFiles(owner, repo, pullNumber)
    .catch(error => {
      console.log("Background review failed ❌");
      console.log(error.message);
    });
});
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
