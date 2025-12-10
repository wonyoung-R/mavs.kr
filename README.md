# Claude Chat - Project "test" Integration

A modern conversational web application that connects to the Claude API with the project "test". The app features a clean, modern UI similar to Claude's main interface, with full responsiveness and rich formatting.

![Claude Chat App Screenshot](https://via.placeholder.com/800x450.png?text=Claude+Chat+Application)

## Features

- **Modern UI Design**: Clean white background with bold typography
- **Project Integration**: Connected to the Claude project "test"
- **API Status Indicator**: Visual feedback on API connection status
- **Rich Formatting**: Markdown support for code blocks, lists, links, and more
- **Conversation History**: Persistent chats stored in local storage
- **Suggested Prompts**: Quick-start questions related to the project
- **Responsive Design**: Works seamlessly on mobile and desktop
- **Loading Indicators**: Visual feedback during API calls

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone this repository or download the files
2. Install dependencies:

```bash
npm install
```

3. The API key is already set in the `.env` file, but if you need to change it, update:

```
CLAUDE_API_KEY=your_api_key_here
```

## Running the Application

Start the server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

Open your browser and navigate to:

```
http://localhost:3000
```

## How It Works

1. The application connects to the Claude API with the configured API key
2. The UI displays an API connection status indicator
3. Users can type messages or select suggested prompts
4. Messages are sent to the Claude API with the project "test" context
5. Claude's responses are rendered with full markdown support
6. Conversation history is stored locally for persistence

## Security Features

- The API key is stored server-side only in the `.env` file
- All API requests are proxied through the Node.js server
- No sensitive data is exposed to the client

## Customization Options

You can customize the application by:

- Modifying the CSS in `public/css/style.css` for visual changes
- Adding more suggested prompts in `public/index.html`
- Changing the Claude model in `server.js` (default is 'claude-3-opus-20240229')
- Updating the system prompt in `server.js` for different project context

## Troubleshooting

If you encounter API connection issues:

1. Check that your API key is valid and has not expired
2. Ensure the Claude API is available and not experiencing downtime
3. Check the browser console and server logs for specific error messages
4. Verify your network connection can reach the Claude API endpoints

## Technical Details

### Frontend
- HTML5, CSS3, and vanilla JavaScript
- Font Awesome for icons
- Google Fonts (Inter) for typography
- Responsive design with CSS media queries

### Backend
- Node.js Express server
- Axios for API requests
- Environment variables with dotenv
- CORS support for cross-origin requests

## License

This project is open source and available for personal and commercial use.
# our-ai-naming-service