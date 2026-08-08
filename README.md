TaskMind – Universal Instruction Translator
<p align="center"> <strong>Turn confusing messages into clear actions</strong><br> Extract actions, deadlines, and urgency from any text </p><p align="center"> <a href="#-features">Features</a> • <a href="#-how-it-works">How It Works</a> • <a href="#-quick-start">Quick Start</a> • <a href="#-installation">Installation</a> • <a href="#-usage">Usage</a> • <a href="#-who-uses-this">Who Uses This</a> • <a href="#-contributing">Contributing</a> • <a href="#-license">License</a> </p><p align="center"> <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version"> <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-green" alt="Node Version"> <img src="https://img.shields.io/badge/LLM-OpenRouter-orange" alt="LLM"> <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="License"> <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome"> <img src="https://img.shields.io/badge/no-login-required-orange" alt="No Login Required"> </p>
📋 Overview
TaskMind is not just another summarizer or chatbot. It's a decision & action clarity tool that transforms confusing messages, emails, announcements, and instructions into structured, actionable items with clear deadlines and urgency levels. Built with Next.js and powered by a server-side LLM (TokenRouter) with rule-based fallbacks, local-first storage, and a privacy policy.

🎯 What It Does
Extracts actionable items from any text using AI

Detects deadlines (even vague ones like "by next week")

Classifies urgency with visual indicators

Highlights confusing parts that need clarification

Provides clear next steps

Translates results into multiple languages

✨ Features
🎯 Action Extractor
Uses AI to detect action verbs like submit, attend, pay, respond and converts them into clear, checkable action items.

📅 Deadline Detector
Transforms vague time references ("by EOD", "next Friday", "end of month") into specific dates with clear visual indicators.

🔴 Urgency Classifier
Visual color-coded urgency levels:

🟢 Low - Can be addressed later

🟡 Medium - Should be addressed this week

🔴 High - Requires immediate attention

⚠️ Confusion Highlighter
Identifies and marks ambiguous or confusing sentences, explaining them in simple terms.

📝 One-Sentence Guidance
Provides a clear "If you do only one thing, do this" recommendation.

🌐 Multi-language Support
One-click translation of analyzed results into multiple languages (starting with Tagalog/Filipino).

🔒 Privacy-First Architecture
Local-first storage: history, templates, and your action board live in your browser

Only the text you analyze is sent to the AI provider to generate results, then stored locally

Share links and sensitive analysis details are in your control, with a full privacy policy

Optional login lets you back up data to your own account

🚀 How It Works
Example Input:
text
"Hi team, just a reminder that the final project needs to be submitted via the online portal by Friday. Also, don't forget about the mandatory presentation tomorrow at 10 AM. Late submissions might have penalties but I need to check the exact rules. See you tomorrow!"
Example Output:
English Analysis

ACTIONS
✅ Submit final project via online portal
✅ Attend mandatory project presentation

DEADLINES
📅 Today: Project presentation at 10:00 AM
📅 Friday, Nov 24: Final submission before 5:00 PM

CONFUSING PARTS
⚠️ Exact penalties for late submission are not specified
⚠️ Presentation duration and grading criteria are unclear

URGENCY LEVEL
🔴 Urgent

NEXT STEP
👉 Prepare for tomorrow's presentation and submit the final project before Friday.

SUMMARY
Immediate action is required due to tight deadlines and an upcoming presentation.

Translate to Tagalog
BUOD
Kinakailangan ang agarang aksyon dahil sa nalalapit na presentasyon at mahigpit na mga deadline.

🛠️ Quick Start
Prerequisites
Node.js 18.0.0 or higher

npm or yarn package manager

Modern web browser with WebAssembly support

Installation
bash
# Clone the repository
git clone https://github.com/jobelGolde12/what_should_i_do.git
cd what_should_i_do

# Install dependencies
npm install

# Start the development server
npm run dev

# Or build for production
npm run build
Basic Usage
javascript
// Using as a module
import { TaskMind } from './src/core/action-clarity.js';

// Initialize with the configured AI provider
const clarity = new TaskMind({
  model: process.env.TOKENROUTER_MODEL || undefined, // empty → auto-route
});

// Analyze your text
const text = "Your confusing message here...";
const result = await clarity.analyze(text);

// Print structured results
console.log(result.toMarkdown());

// Get translation
const tagalogVersion = await clarity.translate(result, 'tl');
Command Line Interface
bash
# Analyze a file (server-side with Node.js)
npm run analyze -- message.txt

# Analyze text directly
npm run analyze:cli -- "Submit report by EOD tomorrow"

# Start the web interface
npm start

👥 Who Uses This Tool
🎓 Students
School announcements and bulletins

Thesis and research instructions

Group project communications

Assignment guidelines

💼 Professionals
Manager emails and directives

HR notices and policy updates

Meeting invitations and minutes

Project requirement documents

👪 Everyday People
Bills and government letters

Barangay notices and announcements

Long Facebook/WhatsApp messages

Legal documents and contracts

🔧 Advanced Features
Custom Model Configuration
Select the model/route via environment variables (server-side):

dotenv
# .env
TOKENROUTER_API_KEY=tr-xxxxxxxx
TOKENROUTER_BASE_URL=https://api.tokenrouter.com/v1
TOKENROUTER_MODEL=           # leave empty for auto-routing
TOKENROUTER_TEMPERATURE=0.1
Export Options
javascript
// Export to various formats
result.export('json');    // JSON format
result.export('csv');     // CSV format
result.export('html');    // HTML report
result.export('markdown'); // Markdown format

// Download file
result.download('actions.json');
🌐 API Reference
REST API (Optional Server Mode)
bash
# Start server (if using server-side processing)
npm run server

# Analyze endpoint
POST /api/analyze
Content-Type: application/json

{
  "text": "Your message here",
  "language": "en",
  "format": "json"
}
Web Interface
Access the web interface at http://localhost:3000 after starting the server:

bash
npm start
📊 Performance
Processing Time: 10-60 seconds for typical messages (AI analysis)

Accuracy: 90%+ on clear action-oriented text

Languages Supported: English (primary), Tagalog, Spanish (coming soon)

Max Text Length: 20,000 characters

Model: Configurable via TokenRouter (OpenAI-compatible gateway)

Privacy: Local-first storage; only the text you analyze is sent to the AI provider

🚀 AI Integration
TaskMind routes analysis through a provider-agnostic AI client (TokenRouter) with schema-validated JSON output, automatic retries/failover, and a rule-based fallback:

- `src/lib/ai.ts` — the AI client (streaming + non-streaming, timeouts, backoff, circuit breaker)
- `src/lib/prompts.ts` — versioned analysis prompt with few-shot examples
- `src/lib/validateAnalysis.ts` — strict zod validation + repair of model output
- `TOKENROUTER_API_KEY` / `TOKENROUTER_MODEL` — configure the provider (see `.env.example`)

Mistral-7B-Instruct-v0.2-q4f32_1

RedPajama-INCITE-Chat-3B-v1-q4f32_1

🤝 Contributing
We welcome contributions! Here's how you can help:

Fork the repository

Create a feature branch (git checkout -b feature/AmazingFeature)

Commit your changes (git commit -m 'Add some AmazingFeature')

Push to the branch (git push origin feature/AmazingFeature)

Open a Pull Request

Areas for Contribution
Adding support for new AI providers/routes via TokenRouter

Improving deadline detection algorithms

Enhancing prompt engineering for better extraction

Creating UI/UX improvements

Adding more language translations

Writing documentation and examples

📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments
TokenRouter for AI model routing

Open source LLM communities for making models accessible

Early testers and users for valuable feedback

📞 Support
Issues: GitHub Issues

Discussions: GitHub Discussions

Documentation: Wiki

🚀 Try It Now
Ready to clarify your messages?

bash
# Clone and run locally
git clone https://github.com/jobelGolde12/what_should_i_do.git
cd what_should_i_do
npm install
npm start

# Then open http://localhost:3000 in your browser
Or visit the live demo: https://taskmind.ai

