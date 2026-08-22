# 🛡️ PR Guardian

**AI-powered GitHub Pull Request reviewer that automatically analyzes code changes and posts review feedback directly on GitHub.**

## 🚀 Live Demo

**Public Demo Repository:**
https://github.com/tishajune06/ai-copilot

**Production Service:**
https://pr-guardian-9qop.onrender.com

> Open a Pull Request in the demo repository and PR Guardian automatically reviews the changed code and posts its feedback on the Pull Request.

---

## ✨ What Does PR Guardian Do?

PR Guardian is an AI-powered code review bot that automatically reviews GitHub Pull Requests.

When a Pull Request is opened or updated:

1. GitHub sends a webhook to PR Guardian.
2. PR Guardian verifies the webhook signature.
3. It fetches the changed files and code diff.
4. Supported files are filtered for review.
5. Large diffs are split into smaller chunks.
6. Google Gemini analyzes the code changes.
7. The generated review is formatted.
8. PR Guardian posts the review directly on the GitHub Pull Request.

---

## 🏗️ Architecture

```text
GitHub Pull Request
        ↓
GitHub Webhook
        ↓
HMAC Signature Verification
        ↓
Fetch PR Files & Diff
        ↓
Filter Supported Files
        ↓
Chunk Large Diffs
        ↓
Google Gemini
        ↓
Format AI Review
        ↓
Post Review to GitHub PR
```

---

## 🔑 Key Features

* GitHub App based authentication
* HMAC-SHA256 webhook signature verification
* Automatic Pull Request event handling
* Changed-file and diff extraction using Octokit
* Supported-file filtering
* Large-diff chunking
* Google Gemini powered code review
* Automatic GitHub PR comments
* Production deployment on Render

---

## 🔐 Authentication

PR Guardian uses **GitHub App installation authentication** instead of a long-lived Personal Access Token.

The application uses:

* GitHub App ID
* Installation ID
* GitHub App private key

Webhook requests are independently verified using a webhook secret before processing.

---

## 🤖 AI Code Review

Google Gemini analyzes the changed code and returns:

* Potential issues
* Code-level suggestions
* Review feedback

The review is then formatted and posted directly to the Pull Request.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express
* **GitHub Integration:** GitHub Apps, Octokit
* **AI:** Google Gemini API
* **Security:** HMAC-SHA256 webhook verification
* **Deployment:** Render

---

## 🧪 Example

A Pull Request changes:

```diff
- res.send("Webhook processed");
+ res.send("processed");
```

PR Guardian receives the Pull Request event, fetches the diff, sends the change to Gemini for analysis, and posts the generated review back to the Pull Request.

---

## 📊 Evaluation

**Evaluation across 15–20 Pull Requests is planned/in progress.**

The following metrics will be measured:

* Genuine issues detected
* False positives
* Precision
* Recall

The final measured results will be added here after testing.

---

## ⚙️ Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/tishajune06/ai-copilot.git
cd ai-copilot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file with your own credentials:

```env
GITHUB_APP_ID=your_github_app_id
GITHUB_INSTALLATION_ID=your_installation_id
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Configure the GitHub App

Create/configure a GitHub App with the required repository permissions, webhook settings, and private key.

### 5. Start the server

```bash
node index.js
```

---

## 📌 Roadmap

* [ ] Evaluate PR Guardian across 15–20 Pull Requests
* [ ] Add measured precision and false-positive rate
* [ ] Add demo GIF
* [ ] Add line-level GitHub review comments
* [ ] Improve issue severity classification
* [ ] Support additional programming languages

---

## 👩‍💻 Author

**Tisha Jindal**

B.Tech Computer Science & Engineering

[GitHub](https://github.com/tishajune06)
