// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { parse, assign, stringify } from 'comment-json';
import { readFileSync } from 'fs';
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
	let enablePodman = config.get<boolean>("rhdc.enablePodman")
	let enableSelinux = config.get<boolean>("rhdc.enableSelinux")

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let editJsonCommand = vscode.commands.registerCommand('rhdc.editJson', () => {
		editJson(enableSelinux, enablePodman)
	});

	context.subscriptions.push(editJsonCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function editJson(selinux: boolean = true, podman: boolean = true, path: string = './.devcontainer/devcontainer.json') {
	let jsonObject = parse(readFileSync(path).toString())
	
	let runArgs = []
	let newJson: Record<string, any> = {}
	
	if (selinux) {
		newJson['workspaceMount'] = ""
		runArgs.push("--volume=${localWorkspaceFolder}:/workspaces/${localWorkspaceFolderBasename}:Z")
	}
	if (podman) {
		newJson['containerUser'] = jsonObject?['remoteUser']:
		runArgs.push('--userns=keep-id')
	}
	newJson['runArgs'] = runArgs

	let newJsonObject = assign(newJson, jsonObject)

	return stringify(newJsonObject, null, 2)
}
