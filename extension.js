const vscode = require('vscode');
const openAiModule = require('openai');
const fs = require('fs');
const path = require('path');

const apiKey = vscode.workspace.getConfiguration('AutoCommit').get('apiKey');
const autoSync = vscode.workspace.getConfiguration('AutoCommit').get('autoSync');

const configuration = new openAiModule.Configuration({
	apiKey: apiKey
});
const openAi = new openAiModule.OpenAIApi(configuration);
const gitExtension = vscode.extensions.getExtension('vscode.git')
let chatCompletion = null;


async function createChatCompletion(changes) {
	try {
		if (changes.length >= 1) {
			chatCompletion = await openAi.createChatCompletion({
				model: 'gpt-3.5-turbo',
				messages: [
					{
						role: 'user',
						content: `
The response you received is not incorrect, as the changes could be interpreted as a refactor (changing the structure of the code without changing its behavior). However, if you want to guide the AI towards interpreting the changes as a new feature (feat), you could clarify the definitions of 'feat' and 'refactor' in your prompt. Here's a revised version of the prompt:

As an AI, your task is to generate a concise and informative commit message following the Conventional Commit standard. This standard requires a commit message to clearly outline the type of changes made and provide a brief, descriptive explanation. The commit message should ideally be within 50 characters and contain no line breaks.

Here are the guidelines:

Begin with the type of change:
'feat' for new features or significant changes that add new capabilities to the code.
'fix' for bug fixes.
'refactor' for changes in the code structure that do not alter its external behavior.
Other types include 'chore', 'docs', 'style', 'perf', 'test', etc.
If a function or method is added, modified, or removed, include that in the message.
Keep the message brief but informative.
For example, if a new feature 'test' replaces two existing functions 'helloWorld' and 'helloWorld2', a suitable commit message could be: 'feat: Replace helloWorld functions with test'.

Now, apply these guidelines to generate a commit message for the following 'git diff':

GIT DIFF
${changes}`
					},
				],
				max_tokens: 1024,
			});
		}
		if (chatCompletion && chatCompletion.data && chatCompletion.data.choices && chatCompletion.data.choices[0]) {
			return chatCompletion.data.choices[0].message.content;
		} else {
			throw new Error('No response from OpenAI')
		}
	} catch (err) {
		console.error(`Error creating chat completion: ${err.message}`);
		vscode.window.showErrorMessage(`Error creating chat completion: ${err.message}`);
	}
}



/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	let disposable2 = vscode.commands.registerCommand('commitAll', async function commitAll() {
		try {
			const allFiles = []
			const gitignorePath = path.join(vscode.workspace.rootPath, '.gitignore');
			let gitignoreContent;
			let allFilesData;

			// Check if the .gitignore file exists before trying to read it
			if (fs.existsSync(gitignorePath)) {
				gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
			}

			if (gitignoreContent) {
				const gitignoreLines = gitignoreContent.split('\n');
				const gitignorePatterns = gitignoreLines
					.filter(line => line.trim() !== '' && !line.startsWith('#'))
					.map(line => '**/' + line.trim());
				const excludePattern = `{${gitignorePatterns.join(',')}}`;
				allFilesData = await vscode.workspace.findFiles('**/*', excludePattern)
			} else {
				allFilesData = await vscode.workspace.findFiles('**/*')
			}

			for (const file of allFilesData) {
				const document = await vscode.workspace.openTextDocument(file);
				allFiles.push(document.uri.fsPath);
			}

			const updatedFileData = await getAllChanges(allFiles);
			await getAllMessages(updatedFileData);

			// Loop over all the files and their messages, commit each one individually
			for (let fileData of updatedFileData) {
				let cmd;
				if (fs.existsSync(fileData.fPath)) {
					cmd = `git add ${fileData.fPath} && git commit -m "${fileData.message}"`;
				} else {
					cmd = `git rm ${fileData.fPath} && git commit -m "${fileData.message}"`;
				}
				const { stderr } = await exec(cmd, { cwd: vscode.workspace.rootPath });

				if (stderr) {
					vscode.window.showErrorMessage(`Error committing file '${fileData.fPath}':`, stderr);
				}
			}
			if (autoSync) {
				const cmd = 'git push';
				const { stderr: pushStderr } = await exec(cmd, { cwd: vscode.workspace.rootPath });

				if (pushStderr && !pushStderr.includes('->')) {
					vscode.window.showErrorMessage(`Error pushing changes:`, pushStderr);
				}
			}

		} catch (error) {
			console.error(`Error committing all: ${error.message}`);
			vscode.window.showErrorMessage(`Error committing all: ${error.message}`);
		}
	});

	const util = require("util");
	const childProcess = require("child_process");
	const exec = util.promisify(childProcess.exec);

	async function getAllChanges(allFiles) {
		try {
			const allFilesData = [];
			const git = await gitExtension.exports.getAPI(1);

			if (!git || !git.repositories || git.repositories.length === 0) {
				throw new Error('No git repositories found');
			}

			const [repo] = await git.repositories;

			const { stdout: deletedFiles, stderr } = await exec('git ls-files --deleted', { cwd: repo.rootUri.fsPath });

			if (stderr) {
				vscode.window.showErrorMessage(`Error for 'git ls-files --deleted' command:`, stderr);
			} else {
				deletedFiles.split('\n').forEach(file => {
					if (file) {
						const fileData = {
							fPath: file,
							changes: 'DELETED'
						};
						allFilesData.push(fileData);
					}
				});
			}

			for (let file of allFiles) {
				if (!fs.existsSync(file)) continue;

				const cmd = `git diff ${file}`;
				const { stdout, stderr } = await exec(cmd, { cwd: repo.rootUri.fsPath });

				if (stderr) {
					vscode.window.showErrorMessage(`Error for 'git diff' command:`, stderr);
					continue;
				}

				if (stdout !== '') {
					const fileData = {
						fPath: file,
						changes: stdout
					};
					allFilesData.push(fileData);
				}
			}

			const { stdout: untrackedFiles, stderr: stderr2 } = await exec('git ls-files --others --exclude-standard', { cwd: repo.rootUri.fsPath });

			if (stderr2) {
				vscode.window.showErrorMessage(`Error for 'git ls-files' command:`, stderr2);
			} else {
				untrackedFiles.split('\n').forEach(file => {
					if (file) {
						const fileData = {
							fPath: file,
							changes: 'UNTRACKED'
						};
						allFilesData.push(fileData);
					}
				});
			}

			return allFilesData;
		} catch (error) {
			console.error(`Error getting all changes: ${error.message}`);
			vscode.window.showErrorMessage(`Error getting all changes: ${error.message}`);
		}
	}

	async function getAllMessages(allFileData) {
		try {
			const messagesPromises = allFileData.map(file => createChatCompletion(file.changes));
			const messages = await Promise.all(messagesPromises);
			allFileData.forEach((file, index) => {
				file.message = messages[index];
			});
		} catch (error) {
			console.error(`Error getting all messages: ${error.message}`);
			vscode.window.showErrorMessage(`Error getting all messages: ${error.message}`);
		}
	}

	context.subscriptions.push(disposable2)
}

function deactivate() { }

module.exports = {
	activate,
	deactivate,
};