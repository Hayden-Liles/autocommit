# AutoCommit - VS Code Extension

AutoCommit is a VS Code extension that automatically generates and commits descriptive and meaningful commit messages based on your changes. It uses the power of GPT-4 by OpenAI to understand your code changes and generates a commit message that follows the Conventional Commit standards.

## Features

- Automatically generates commit messages based on your changes. (Uses gpt 3.5 - 4 was unessicary and more expensive)
- Commits each changed file separately with a relevant commit message. (The Prompt is 316 Tokens OR $0.000474)
- Avoids committing files specified in `.gitignore`.
- Optionally pushes changes to the remote repository automatically. (Can be changed in settings DEFAULT: true)

## Setup

1. Install the extension in VS Code.
2. In your VS Code settings (`.vscode/settings.json`), add your OpenAI API Key:

## Usage
After installing and setting up the extension, navigate to your source control and you will see a green button
Click it and you are done.

This command will:

Find all changed and new files in your workspace.
Generate a commit message for each file based on its changes.
Commit each file separately with its generated commit message.
If autoSync is enabled, it will push the changes to the remote repository.

## License
MIT

This README.md provides the necessary information for users to understand what the extension does, how to set it up, and how to use it. You can always expand it and add more sections such as a FAQ or Known Issues, if needed.
