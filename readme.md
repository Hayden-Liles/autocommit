# AutoCommit - VS Code Extension

AutoCommit is a VS Code extension that automatically generates and commits descriptive and meaningful commit messages based on your changes. It uses the power of GPT-4 by OpenAI to understand your code changes and generates a commit message that follows the Conventional Commit standards.

## Features

- Automatically generates commit messages based on your changes. (Uses gpt 3.5 - 4 was unessicary and more expensive)
- Commits each changed file separately with a relevant commit message. (The Prompt is 316 Tokens OR $0.000474)
- Avoids committing files specified in `.gitignore`.
- Optionally pushes changes to the remote repository automatically. (Can be changed in settings DEFAULT: true)

## RATE LIMITS FOR FREE VERSION
When you see this, this is due to openAI<br>
Error Code 429 - Rate limit reached for requests <br>
I reccomend getting the "Pay as you go" version I made this so that 10,000 commits will cost about $4.50
![Error](https://github.com/Hayden-Liles/autocommit/assets/118101156/bc8de577-9c39-460c-b839-60ce06249408)
<br>

## Setup
### STEP 1
- Goto -> https://platform.openai.com/ <br><br>
![Step1](https://github.com/Hayden-Liles/autocommit/assets/118101156/3121da3a-635c-4feb-bd20-2142a9e4edf3)
### Step 2
- Sign up OR Login <br><br>
![Step2](https://github.com/Hayden-Liles/autocommit/assets/118101156/6e5908b9-eaef-448c-b056-dadbdd2e693a)
### Step 3
- Click on your profile image. Cick "View API keys" <br><br>
![Step3](https://github.com/Hayden-Liles/autocommit/assets/118101156/1ace5a62-da6a-4807-bd55-dc30b85cb217)
### Step 4
- Click "Create new secret key" <br><br>
![Step4](https://github.com/Hayden-Liles/autocommit/assets/118101156/110cde8d-9844-4bc6-a03c-789c95334229)
### Step 5
- Name your key. <br><br>
![Step5](https://github.com/Hayden-Liles/autocommit/assets/118101156/2ff54d9b-a4e6-493d-b4f1-0b7cbef78152)
### Step 6
- Copy your key. <br><br>
![Step6](https://github.com/Hayden-Liles/autocommit/assets/118101156/2ef38b2e-8e1d-401b-95f2-9edc8a934d46)
### Step 7
- Open Vscode settings (ctrl + ,)<br>
- Go to Extensions -> goto AutoCommit<br>
- Paste your Key<br><br>
![Step7](https://github.com/Hayden-Liles/autocommit/assets/118101156/fbed5a77-eff7-4204-b55f-ebfb07cbb935)

## Usage
After installing and setting up the extension, navigate to your source control and you will see a green button<br>
Click it and you are done.<br>
![Usage 1](https://github.com/Hayden-Liles/autocommit/assets/118101156/f80732de-9515-446f-9ea0-b26b58302cdf)
![Usage 3](https://github.com/Hayden-Liles/autocommit/assets/118101156/90598a7d-ad1c-4d3c-b64f-a171ecc21290)
![Usage 2](https://github.com/Hayden-Liles/autocommit/assets/118101156/0e0ce51c-ca07-421d-a6ff-bc5de3c67f16)


**This command will**:<br>
- Find all changed and new files in your workspace.<br>
- Generate a commit message for each file based on its changes.<br>
- Commit each file separately with its generated commit message.<br>
- If autoSync is enabled, it will push the changes to the remote repository.<br>
<br>
## License
MIT

This README.md provides the necessary information for users to understand what the extension does, how to set it up, and how to use it. You can always expand it and add more sections such as a FAQ or Known Issues, if needed.
