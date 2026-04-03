# RolePlay Chat

A private AI roleplay chat application with multi-provider support, memory integration, and character management.

**Live Demo:** https://roleplay-6hg.pages.dev/

## Features

- **Multi-Provider AI Support** - Connect to OpenAI, Anthropic, Google, Groq, Perplexity, Mistral, and custom endpoints
- **Character Management** - Create, edit, import/export AI personas with rich metadata
- **Chat History** - Organize conversations by character with full message history
- **Memory System** - AI-powered memory extraction that learns from conversations
- **Context Condensation** - Smart summarization to maintain long conversations within token limits
- **Scene Image Generation** - Generate cinematic scene images using Stable Diffusion
- **Lightweight & Private** - All data stored locally in your browser (IndexedDB)

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with shadcn/ui components
- **State Management:** Zustand
- **Database:** IndexedDB (via Dexie.js)
- **AI Providers:** OpenAI-compatible API endpoints

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- API keys for your preferred AI provider

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd roleplay-chat

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Configuration

1. Click the **Settings** button in the sidebar
2. Add your API provider credentials (API key and endpoint URL)
3. Select your preferred model
4. Optionally configure your user persona

## License

This software is licensed under a **proprietary license** with the following restrictions:

### Permitted Use

- Personal and non-commercial use
- Educational and research purposes
- Private, non-public deployments

### Prohibited Use

**You may NOT use this software:**

- For any commercial purposes or business activities
- To provide services to third parties (whether free or paid)
- In any product or service that competes with this project
- To build a competing SaaS or hosted service
- For any illegal or unauthorized purposes

### Intellectual Property

Copyright (c) 2024 RolePlay Chat. All rights reserved.

This software is the proprietary property of its authors. The source code is provided for inspection and educational purposes only. By accessing or using this software, you agree to be bound by the terms of this license.

---

*If you are interested in commercial licensing or enterprise deployments, please contact the project maintainer.*
