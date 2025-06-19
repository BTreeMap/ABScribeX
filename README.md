# ABScribeX

ABScribeX brings ABScribe's in-place Variation Fields and reusable AI Modifiers to any web editor—be it Gmail, LinkedIn, or Reddit—via a synchronized pop-up interface, enabling rapid, non-linear exploration and organization of multiple writing variants right where you compose.

## About

ABScribeX is a Chrome extension that implements the research concepts from the [ABScribe paper](https://doi.org/10.48550/arXiv.2310.00117), which won recognition at CHI 2024. The original ABScribe study showed that this approach significantly reduces writing workload and enhances the revision process when working with AI-generated text variations.

## Key Features

- **Universal Web Editor Support**: Works seamlessly with Gmail, LinkedIn, Reddit, and any web-based text editor
- **In-Place Variations**: View and compare multiple writing variations without cluttering your document
- **AI Modifier Buttons**: Convert prompts into reusable buttons for quick text transformations
- **Synchronized Interface**: Popup window stays in sync with your original content
- **Non-Destructive Editing**: Explore variations without overwriting your original text
- **Context Menu Integration**: Right-click any text field to start editing with ABScribeX

## How It Works

1. **Capture**: Right-click on any text field or editor on the web
2. **Edit**: Use the popup interface to generate and explore writing variations
3. **Apply**: Choose your preferred variation and apply it back to the original editor

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Load the extension in Chrome from the `dist` folder

## Development

```bash
npm install
npm run dev      # Development mode with hot reload
npm run build    # Production build
npm run test     # Run tests
```

## Research Background

ABScribeX is based on the [CHI 2024 paper](https://doi.org/10.1145/3613904.3641899) "ABScribe: Rapid Exploration & Organization of Multiple Writing Variations in Human-AI Co-Writing Tasks using Large Language Models" by Mohi Reza, Nathan Laundry, and colleagues. The research demonstrates that this interface approach significantly improves the writing process when working with AI-generated content.

## License

This project builds upon the ABScribe research and is intended for educational and research purposes.
