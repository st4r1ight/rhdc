// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { parse, assign, stringify, CommentJSONValue, CommentArray, CommentObject } from 'comment-json';
import { existsSync, fstat, readdirSync, readFileSync, writeFileSync } from 'fs';
import { chdir } from 'process';
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

	// Parse RHDC config
	// See package.json for more information
	let config = vscode.workspace.getConfiguration('rhdc')
	let enablePodman = config.get<boolean>("rhdc.enableRootlessPodman") ?? true
	let enableSelinux = config.get<boolean>("rhdc.enableSelinux") ?? true
	let workspacePath = config.get<string>("rhdc.workspacePath") ?? "/workspaces/${localWorkspaceFolderBasename}"

	// Command to edit devcontainer.json.
	// Goes through every folder in the workspace and tries to find and edit a devcontainers.json file.
	// If it doesn't find any, an error is thrown.
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

/**
 * Edits the devcontainer.json file in the given workspace
 * @param selinux Whether or not to add options necessary for SELinux compatibility
 * @param podman Whether or not to add options necessary for Podman compatibility
 * @param path The path of the workspace to edit JSON in
 * @param workspaceMountPath The path within the container to mount the workspace
 * 
 * @return True if it can find a JSON file to edit, false if not.
 * 
 */
function editJson(selinux: boolean, podman: boolean, path: string, workspaceMountPath: string): boolean {
	const containerFile = './.devcontainer/devcontainer.json'
	
	chdir(path)
	if (!existsSync(containerFile)) {
		return false
	}
	
	let jsonObject = parse(readFileSync('./.devcontainer/devcontainer.json').toString())! as CommentObject
	if (!jsonObject) { throw Error("Error parsing Dev Containers JSON file") }
	 
	// comment-json is a bit weird with types.
	// RunArgs can be undefined or a CommentArray, but it's also able to be a string[] here,
	// so that if it is undefined we can just make it an empty array.
	let runArgs = jsonObject.runArgs as CommentArray<string> | undefined | string[]
	if (!runArgs) {
		runArgs = []		
	}
	let newJson: Record<string, any> = {}
	
	// Workaround for SELinux.
	// Tells VSCode not to mount the workspace and then manually mounts it with SELinux's :Z flag.
	// Source: https://github.com/microsoft/vscode-remote-release/issues/1333#issuecomment-898260126
	if (selinux) {
		newJson['workspaceMount'] = ""
		runArgs.push("--volume=${localWorkspaceFolder}:" + workspaceMountPath + ':Z')
	}

	// Workaround for Podman rootless containers
	// Makes sure that the container user and the remote user are the same,
	// and tells Podman to preserve user IDs.
	// Source: https://blog.lifeishao.com/2021/12/30/replacing-docker-with-podman-for-your-vscode-devcontainers/
	if (podman) {
		newJson['containerUser'] = jsonObject['remoteUser'] ?? 'root'
		runArgs.push('--userns=keep-id')
	}
	newJson['runArgs'] = runArgs

	let newJsonObject = assign(newJson, jsonObject)

	writeFileSync(containerFile, stringify(newJsonObject, null, 2))
	return true
}
