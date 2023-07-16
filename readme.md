# Convert TypeScript to Markdown

## Conceptualize and Plan the Project
Understand the project's core functionality and sketch a rough outline of how you'll implement it. Identify key features and brainstorm how to develop them using available resources. Determine the libraries and APIs you'll need.

## Set Up Your Environment
Ensure you have Node.js and npm installed. Install the Visual Studio Code Extension Development Kit. Create a new directory for your project and initialize a new Node.js project in this directory using npm.

## Create a New VS Code Extension
Use Yeoman and the VS Code Extension Generator to create a new VS Code extension. This will generate a basic extension structure. Navigate to your project's directory in your terminal and run the command yo code to start the generator. Follow the prompts to create your extension.

## Integrate autoGPT Library
First, navigate to the root of your project's directory in your terminal and run the command npm install auto-gpt to install the library.
Now, go to your extension.ts file (or whatever your main file is called), and at the top, add 
```typescript
import * as autoGPT from 'auto-gpt'
```
 This line allows your extension to utilize the AutoGPT library.

## Set Up Git Extension API
In your extension.ts file, at the top, add 
```
import * as vscode from 'vscode'
```
This imports the VS Code API.
Add the following lines to get the Git API:
```typescript
const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
if (!gitExtension) {
  throw new Error('Git extension not found');
}
```
This checks if the Git extension is available and throws an error if it isn't.

## Implement Commit Message Generation:

Start by getting the Git repository object from the Git API:
```typescript
const repo = gitExtension.getAPI(1).repositories[0];
```
Then use the repo.diffWithHEAD() method to get the list of changes since the last commit.
For each change, read the file contents and generate a commit message:
```typescript
const filePath = change.uri.fsPath;
const fileContent = fs.readFileSync(filePath, 'utf-8');
const summary = await autoGPT.summarize(fileContent);
const message = `Update ${filePath} - ${summary}`;
```
Finally, stage the changes and commit them:
```typescript
await repo.add([vscode.Uri.file(filePath)]);
await repo.commit(message);
```
Add User Review Feature:

Replace the repo.commit(message) line with the following code to allow the user to review the commit message:
```typescript
await vscode.commands.executeCommand('git.commit', vscode.Uri.file(filePath), '--verbose', '-m', message);
```
This opens a text editor with the commit message, allowing the user to review and edit it before committing.

## Add Command to Trigger the Process:

Register a new command that triggers your commit message generation process when activated:
```typescript
const commandId = 'extension.commitChangesWithMessage';
context.subscriptions.push(
  vscode.commands.registerCommand(commandId, async () => {
    await commitChangesWithGeneratedMessages();
  })
);
```
This creates a new command with the ID extension.commitChangesWithMessage, and registers it with the command when the extension is activated.

## Create Status Bar Item:

Use the vscode.window.createStatusBarItem() method to create a new status bar item. Assign a command to it that triggers the commit message generation process when the status bar item is clicked:
```typescript
const statusBarCommand = 'extension.commitChangesWithMessage';
const statusBarText = '$(git-commit) Auto Commit';
const statusBarToolTip = 'Click to auto generate commit messages for changed files';

const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
statusBarItem.command = statusBarCommand;
statusBarItem.text = statusBarText;
statusBarItem.tooltip = statusBarToolTip;
statusBarItem.show();
context.subscriptions.push(statusBarItem);
```
This creates a status bar item with the text "Auto Commit", assigns the extension.commitChangesWithMessage command to it, and displays it on the status bar.

## Test the Extension: 
Test your extension in a development host window to ensure it's working as expected. Use the Run Extension command in your debugging sidebar to open a new window with your extension loaded. Make changes to your files and use your new command and status bar item to auto-generate commit messages.

## Package the Extension:
 When you're ready to publish your extension, you'll need to package it into a .vsix file. VS Code uses the vsce package to do this. Install it with npm install -g vsce and then run vsce package in your project's directory. This will create a .vsix file that you can share or publish.

## Publish the Extension:
 Finally, publish your extension to the Visual Studio Code Marketplace. You'll need to create a publisher ID, and you can then use the vsce publish command to publish your extension. Be sure to carefully read and follow the Marketplace's rules and guidelines.

## Original Documentation
https://chat.openai.com/share/115d0a95-c082-4014-983f-2f939445aebb