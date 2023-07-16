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
	As an AI, your task is to create a succinct, informative commit message following the Conventional Commit standard. This standard requires a commit message that clearly outlines the type of changes made (feat, fix, refactor, etc.), along with a brief yet descriptive explanation. The commit message should ideally be within 50 characters.
	Here are a few guidelines:
	1. Start with the type of change: 'feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'perf', 'test', etc.
	2. If a function or method is added or removed, make sure to include that in the message.
	3. Keep it brief, yet informative.
	4. Keep it all on the same line meaning no line breaks.
	For example, given a 'git diff' where a new feature 'test' replaces two existing functions 'helloWorld' and 'helloWorld2', a possible commit message could be: 'feat: Replace helloWorld functions with test'.					
	Here are some elaborated guidelines:
	The commit message should start with the type of change, i.e., 'feat', 'fix', etc. This type provides an immediate understanding of the nature of the changes in the commit.
	If the commit involves the addition, modification, or removal of functions or methods, these should be explicitly mentioned in the message. This gives a quick overview of where in the codebase the changes have been made.
	While brevity is important, do not sacrifice necessary information for the sake of a shorter message. Your goal is to communicate effectively with your team.
	To illustrate this, suppose we have a 'git diff' that shows a new feature, called 'test', replacing two existing functions: 'helloWorld' and 'helloWorld2'. A possible commit message following these guidelines could be: 'feat: Replace helloWorld functions with test'. This message is succinct, gives an immediate overview of the change type (a feature), and describes the essence of the changes (replacement of two functions with a new one).
	Now, let's apply these guidelines to the given 'git diff':
	GIT DIFF
	diff
	Copy code
	diff --git a/test.py b/test.py
	index a3d76e1..7e5b5d0 100644
	--- a/test.py
	+++ b/test.py
	@@ -1,5 +1,3 @@
	-def helloWorld():
	- print("Hello, World!")
	-
	-def helloWorld2():
	- print("Hello, World2!")
	+def test():
	+ print("test")
	+ \ No newline at end of file
	The diff shows the removal of two functions: 'helloWorld' and 'helloWorld2', and the introduction of a new function: 'test'. Hence, a commit message in line with the Conventional Commit standards could be: 'feat: Replace helloWorld functions with test'. This message succinctly conveys that a new feature has been implemented in the 'test.py' file, and this feature involves replacing the 'helloWorld' functions with a new function named 'test'.
	Now, here's a 'git diff' for you to generate a commit message:
	***GIT DIFF***${changes}`
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
		console.error('Error creating chat completion:', err);
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
				console.log('FILEDATA', fileData)
				console.log('message???', fileData.message)
				const cmd = `git add ${fileData.fPath} && git commit -m "${fileData.message}"`;
				const { stdout, stderr } = await exec(cmd, { cwd: vscode.workspace.rootPath });

				if (stderr) {
					console.error(`Error committing file '${fileData.fPath}':`, stderr);
				}
			}
			if (autoSync) {
				const cmd = 'git push';
				const { stdout: pushStdout, stderr: pushStderr } = await exec(cmd, { cwd: vscode.workspace.rootPath });

				if (pushStderr) {
					console.error(`Error pushing changes:`, pushStderr);
				}
			}

		} catch (error) {
			console.error(error)
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

			for (let file of allFiles) {
				const cmd = `git diff ${file}`;
				const { stdout, stderr } = await exec(cmd, { cwd: repo.rootUri.fsPath });

				if (stderr) {
					console.error(`Error for 'git diff' command:`, stderr);
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

			const { stdout: untrackedFiles, stderr } = await exec('git ls-files --others --exclude-standard', { cwd: repo.rootUri.fsPath });

			if (stderr) {
				console.error(`Error for 'git ls-files' command:`, stderr);
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
			console.error(error);
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
			console.error(error);
		}
	}

	context.subscriptions.push(disposable2)
}

function deactivate() { }

module.exports = {
	activate,
	deactivate,
};