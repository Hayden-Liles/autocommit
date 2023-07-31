const vscode = require('vscode');
const { exec } = require('child_process');
const openAiModule = require('openai');
const fs = require('fs').promises;
const { isText } = require('istextorbinary');
const path = require('path');

const apiKey = vscode.workspace.getConfiguration('AutoCommit').get('apiKey');

const configuration = new openAiModule.Configuration({
	apiKey: apiKey
});
const openAi = new openAiModule.OpenAIApi(configuration);

function getGitChanges(workspaceRoot, callback) {
    exec('git status --porcelain', { cwd: workspaceRoot }, (error, stdout, stderr) => {
        const result = {
            untracked: [],
            modified: [],
            unreadable: [],
            untrackedAndUnreadable: [],
            deleted: []
        };

        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }

        const lines = stdout.split('\n');
        for (let line of lines) {
            const status = line.slice(0, 2).trim();
            const file = line.slice(3).trim();
    
            if (status === '??') {
                // Check if the file is a text file
                const isTextual = isText(workspaceRoot + '/' + file);
                console.log(`${file} is text: ${isTextual}`)
                if (isTextual && isTextual != null) {
                    result.untracked.push(file);
                } else {
                    result.unreadable.push(file);
                }
            } else if (['A', 'M'].includes(status)) {
                result.modified.push(file);
            } else if (status === 'D') {
                result.deleted.push(file);
            }
            // More status codes can be added as needed
        }
    

        callback(result);
    });
}

function escapeSpaces(filePath) {
    return `${filePath}`;
}

async function getGitDiff(workspaceRoot, file) {
    return new Promise((resolve, reject) => {
        exec(`git diff ${file}`, { cwd: workspaceRoot }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

async function generateCommitMessage(workspaceRoot, file, changeType) {
    let prompt;
    if (changeType === "untracked") {
        let content;
        try {
            let fullContent = await fs.readFile(workspaceRoot + '/' + file, 'utf8');
            content = fullContent.substring(0, 3000); 
        } catch (err) {
            console.error(`Error reading ${file}: ${err}`);
            return `Error reading file ${file}`;
        }

        prompt = `
        As an AI, generate a concise, informative commit message following the Conventional Commit standard. This standard requires a commit message to outline the type of changes (e.g., 'feat', 'fix', 'refactor') and provide a brief explanation. The message should be within 50 characters and contain no line breaks.

        Guidelines:
        
        Begin with the type of change: 'feat', 'fix', 'refactor', etc.
        If a new file is being added, include the file name and a brief description of its purpose or contents.
        Keep the message brief but informative.
        For example, if a new file 'test.py' is added with a function 'helloWorld', a suitable commit message could be: 'feat: Add test.py with helloWorld function'.
        
        Now, generate a commit message for the following new code file:
        
        NEW CODE FILES CONTENT:
        ${content}`;
    } else if (changeType === "modified") {
        let diff;
        try {
            diff = await getGitDiff(workspaceRoot, file);
        } catch (err) {
            console.error(`Error getting diff for ${file}: ${err}`);
            return `Error fetching diff for ${file}`;
        }

        prompt = `
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
        ${diff}`;
    }

    try {
        const chatCompletion = await openAi.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1024,
        });

        if (chatCompletion && chatCompletion.data && chatCompletion.data.choices && chatCompletion.data.choices[0]) {
            return chatCompletion.data.choices[0].message.content;
        } else {
            throw new Error('No response from OpenAI');
        }
    } catch (err) {
        console.error(`Error fetching commit message from OpenAI for ${file}: ${err}`);
        return `Error fetching commit message for ${file}`;
    }
}

async function pushToRemote(workspaceRoot) {
    return new Promise((resolve, reject) => {
        exec('git push', { cwd: workspaceRoot }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Push error: ${error}`);
                reject(error);
            } else {
                console.log('Successfully pushed commits to remote.');
                resolve();
            }
        });
    });
}

class UnpushedCommitsProvider {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    async getUnpushedCommits() {

        const gitDir = path.join(this.workspaceRoot, '.git');
        try {
            await fs.access(gitDir, fs.constants.F_OK);
        } catch (err) {
            console.log("Workspace is not a Git repository.");
            return [];
        }

        return new Promise((resolve, reject) => {
            // Get log of unpushed commits
            exec('git log @{u}.. --format="%H"', { cwd: this.workspaceRoot }, async (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error fetching unpushed commits: ${error}`);
                    reject(error);
                } else {
                    const commitHashes = stdout.trim().split('\n');
                    let formattedCommits = [];
    
                    for (const hash of commitHashes) {
                        await new Promise((resolveInner, rejectInner) => {
                            exec(`git show ${hash} --name-only --oneline`, { cwd: this.workspaceRoot }, (err, stdout, stderr) => {
                                if (err) {
                                    console.error(`Error fetching commit details: ${err}`);
                                    rejectInner(err);
                                } else {
                                    let parts = stdout.split('\n');
                                    let commitMessage = parts[0].split(' ').slice(1).join(' ');
                                    let fileName = parts[1];
                                    formattedCommits.push({ label: `${fileName} : ${commitMessage}`, commitHash: hash });
                                    resolveInner();
                                }
                            });
                        });
                    }
                    resolve(formattedCommits);
                }
            });
        });
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (!element) {
            const commits = await this.getUnpushedCommits();
            return commits.map(commit => new vscode.TreeItem(commit));
        }
        return [];
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

    const workspaceRoot = vscode.workspace.rootPath;
    let provider = new UnpushedCommitsProvider(workspaceRoot);
    vscode.window.registerTreeDataProvider('unpushedCommits', provider);
    provider.refresh();

	let disposable2 = vscode.commands.registerCommand('commitAll', async function commitAll() {
        const workspaceRoot = vscode.workspace.rootPath;

    if (!workspaceRoot) {
        vscode.window.showErrorMessage("No workspace opened. Please open a Git repository.");
        return;
    }

    const changes = await new Promise(resolve => getGitChanges(workspaceRoot, resolve));

    for (const file of changes.untracked.concat(changes.modified)) {
        const changeType = changes.untracked.includes(file) ? "untracked" : "modified";
        const message = await generateCommitMessage(workspaceRoot, file, changeType);
        const escapedFile = escapeSpaces(file);

        await new Promise((resolve, reject) => {
            exec(`git add ${escapedFile} && git commit -m "${message}"`, { cwd: workspaceRoot }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Commit error for ${file}: ${error}`);
                    reject(error);
                } else {
                    console.log(`Committed ${file} with message: "${message}"`);
                    resolve();
                }
            });
        });
    }

    for (const file of changes.unreadable.concat(changes.untrackedAndUnreadable, changes.deleted)) {
        const action = changes.deleted.includes(file) ? "Deleted" : "Added";
        const message = `${action} ${file}`;
        const escapedFile = escapeSpaces(file);

        await new Promise((resolve, reject) => {
            const command = changes.deleted.includes(file) 
                ? `git rm ${escapedFile} && git commit -m "${message}"`
                : `git add ${escapedFile} && git commit -m "${message}"`;

            exec(command, { cwd: workspaceRoot }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Commit error for ${file}: ${error}`);
                    reject(error);
                } else {
                    console.log(`Committed ${file} with message: "${message}"`);
                    resolve();
                }
            });
        });
    }

    const unpushedCommitsProvider = new UnpushedCommitsProvider(workspaceRoot);
    vscode.window.registerTreeDataProvider('unpushedCommits', unpushedCommitsProvider);

    const autoSyncEnabled = vscode.workspace.getConfiguration('AutoCommit').get('autoSync');
    if (autoSyncEnabled) {
        await pushToRemote(workspaceRoot);
    } else {
        unpushedCommitsProvider.refresh();
    }
    });
    
	context.subscriptions.push(disposable2)
}

function deactivate() { }

module.exports = {
	activate,
	deactivate,
};
