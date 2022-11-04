// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { parse, assign, stringify, CommentJSONValue, CommentArray, CommentObject } from 'comment-json';
import { channel } from 'diagnostics_channel';
import { existsSync, fstat, readdirSync, readFileSync, writeFileSync } from 'fs';
import { chdir, cwd } from 'process';
import * as vscode from 'vscode';

interface ExtensionConfig {
	useSelinux: boolean,
	usePodman: boolean
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "rhdc" is now active!');

	let config = vscode.workspace.getConfiguration('rhdc')
	let enablePodman = config.get<boolean>("rhdc.enablePodman") ?? true
	let enableSelinux = config.get<boolean>("rhdc.enableSelinux") ?? true
	let workspacePath = config.get<string>("rhdc.workspacePath") ?? "/workspaces/${localWorkspaceFolderBasename}"

	console.log(workspacePath)

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let editJsonCommand = vscode.commands.registerCommand('rhdc.editJson', () => {
		let workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders) {
			let success = false
			workspaceFolders.forEach((it) => {
				let result = editJson(enableSelinux, enablePodman, it.uri.fsPath, workspacePath)
				if (result) success = true
			})

			if (success) {
				vscode.window.showInformationMessage("RHDC completed successfully")
			} else {
				vscode.window.showErrorMessage("None of your workspaces had Dev Container JSON files in them!")
			}

		} else {
			vscode.window.showErrorMessage('RHDC error: You have not opened a workspace!')
		}
	});

	context.subscriptions.push(editJsonCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function editJson(selinux: boolean, podman: boolean, path: string, workspacePath: string): boolean {
	const containerFile = './.devcontainer/devcontainer.json'
	
	chdir(path)
	if (!existsSync(containerFile)) {
		return false
	}
	
	let jsonObject = parse(readFileSync('./.devcontainer/devcontainer.json').toString())! as CommentObject
	if (!jsonObject) { throw Error("Error parsing Dev Containers JSON file") }
	 
	
	let runArgs = jsonObject.runArgs as CommentArray<string> | undefined | string[]
	if (!runArgs) {
		runArgs = []		
	}
	let newJson: Record<string, any> = {}
	
	if (selinux) {
		newJson['workspaceMount'] = ""
		runArgs.push("--volume=${localWorkspaceFolder}:" + workspacePath + ':Z')
	}
	if (podman) {
		newJson['containerUser'] = jsonObject['remoteUser'] ?? 'root'
		runArgs.push('--userns=keep-id')
	}
	newJson['runArgs'] = runArgs

	let newJsonObject = assign(newJson, jsonObject)

	writeFileSync(containerFile, stringify(newJsonObject, null, 2))
	return true
}
