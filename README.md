ActionClarity – Universal Instruction Translator
<p align="center"> <strong>Turn confusing messages into clear actions</strong><br> Extract actions, deadlines, and urgency from any text </p><p align="center"> <a href="#-features">Features</a> • <a href="#-how-it-works">How It Works</a> • <a href="#-quick-start">Quick Start</a> • <a href="#-installation">Installation</a> • <a href="#-usage">Usage</a> • <a href="#-who-uses-this">Who Uses This</a> • <a href="#-contributing">Contributing</a> • <a href="#-license">License</a> </p><p align="center"> <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version"> <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-green" alt="Node Version"> <img src="https://img.shields.io/badge/LLM-WebLLM-orange" alt="Web LLM"> <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="License"> <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome"> <img src="https://img.shields.io/badge/no-login-required-orange" alt="No Login Required"> </p>
📋 Overview
ActionClarity is not just another summarizer or chatbot. It's a decision & action clarity tool that transforms confusing messages, emails, announcements, and instructions into structured, actionable items with clear deadlines and urgency levels. Built with Node.js and powered by Web LLM for privacy-focused, client-side processing.

🎯 What It Does
Extracts actionable items from any text using Web LLM

Detects deadlines (even vague ones like "by next week")

Classifies urgency with visual indicators

Highlights confusing parts that need clarification

Provides clear next steps

Translates results into multiple languages

✨ Features
🎯 Action Extractor
Uses Web LLM to detect action verbs like submit, attend, pay, respond and converts them into clear, checkable action items.

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
Web LLM runs locally in your browser

No data sent to external servers

Complete privacy for sensitive messages

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
import { ActionClarity } from './src/core/action-clarity.js';

// Initialize with Web LLM
const clarity = new ActionClarity({
  model: 'llama-2-7b-chat-q4f32_1', // or other supported Web LLM models
  device: 'webgpu' // or 'webgl' depending on browser support
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
javascript
const clarity = new ActionClarity({
  model: 'mistral-7b-instruct-q4f32_1',
  device: 'webgpu',
  temperature: 0.3,
  maxTokens: 1000
});
Browser Integration
html
<script type="module">
  import { ActionClarity } from 'https://cdn.jsdelivr.net/npm/actionclarity@latest/dist/actionclarity.min.js';
  
  const clarity = new ActionClarity();
  const result = await clarity.analyze("Your message here");
  
  // Display in your UI
  document.getElementById('result').innerHTML = result.toHTML();
</script>
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
Processing Time: 2-3 seconds for typical messages (Web LLM)

Accuracy: 90%+ on clear action-oriented text

Languages Supported: English (primary), Tagalog, Spanish (coming soon)

Max Text Length: 5,000 characters (browser memory constraints)

Model Size: ~4GB (quantized models for browser)

Privacy: 100% client-side processing

🚀 Web LLM Integration
ActionClarity uses Web LLM to run language models directly in your browser:

javascript
// Initialize Web LLM
const llm = new WebLLM({
  model: 'Llama-2-7b-chat-hf-q4f32_1',
  device: 'webgpu',
  initProgressCallback: (progress) => {
    console.log(`Loading model: ${progress}`);
  }
});

await llm.initialize();
Supported Models
Llama-2-7b-chat-hf-q4f32_1

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
Adding support for new Web LLM models

Improving deadline detection algorithms

Enhancing prompt engineering for better extraction

Creating UI/UX improvements

Adding more language translations

Writing documentation and examples

📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments
MLC AI for the amazing Web LLM framework

Open source LLM communities for making models accessible

Early testers and users for valuable feedback

The WebGPU and WebAssembly communities

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
Or visit the live demo: https://whatshouldido-five.vercel.app

