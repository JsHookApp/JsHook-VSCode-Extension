const vscode = require('vscode');
const net = require('net');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	console.log('Welcome JsHook-VSCode-Extension!');

	const fs = vscode.workspace.fs;
	const filePath = vscode.Uri.joinPath(context.extensionUri, '/assets/home.html');
	const htmlContent = await fs.readFile(filePath)
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('activitybarview_home', {
			resolveWebviewView: (webviewView) => {
				webviewView.webview.options = {
					enableScripts: true,
				};
				webviewView.webview.html = htmlContent.toString();
			},
		})
	);
	let logwebview = null;
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('panelview_log', {
			resolveWebviewView: (webviewView) => {
				webviewView.webview.options = {
					enableScripts: true,
				};
				logwebview = webviewView;
			},
		})
	);

	const socketServer = {
		sendData: (input, data, fun = null) => {
			let buffer = '';
			let socket = net.createConnection(9358, input);
			socket.on('connect', () => {
				console.log('Connected to server.');
				socket.write(data + "\n")
			});
			socket.on('data', (data) => {
				buffer += data;
				let index;
				while ((index = buffer.indexOf('\n')) !== -1) {
					const message = buffer.slice(0, index);
					// console.log(`Received data: ${message}`);
					try {
						fun && fun(message);
					} catch (e) {
						vscode.window.showErrorMessage(e.message);
					}
					buffer = buffer.slice(index + 2);
				}
			});
			socket.on('error', (error) => {
				vscode.window.showErrorMessage(`Socket error: ${error}`);
			});
			socket.on('close', () => {
				console.log('Socket closed.');
			});
		}
	};

	const getfile = async (resource) => {
		let fileContent;
		let fileName;
		let filePath;
		if (
			resource &&
			resource.scheme === 'file' &&
			resource.fsPath.endsWith('.js')
		) {
			fileName = path.basename(resource.fsPath);
			filePath = vscode.workspace.asRelativePath(resource.fsPath);
			const uri = vscode.Uri.file(resource.fsPath);
			try {
				fileContent = await vscode.workspace.fs.readFile(uri);
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to read file: ${error}`);
			}
		} else {
			const editor = vscode.window.activeTextEditor;
			fileName = path.basename(editor.document.fileName);
			filePath = vscode.workspace.asRelativePath(editor.document.fileName);
			if (editor && editor.document.uri.scheme === 'file' && editor.document.uri.fsPath.endsWith('.js')) {
				fileContent = editor.document.getText();
			}
		}
		console.log('FileContent:' + filePath + ':' + fileContent.length);
		return [filePath, fileName, fileContent.toString()];
	}

	const getfilepath = async (resource) => {
		let filePath;
		let filePathP;
		if (
			resource &&
			resource.scheme === 'file' &&
			resource.fsPath.endsWith('.js')
		) {
			filePathP = resource.fsPath;
			filePath = vscode.workspace.asRelativePath(resource.fsPath);
		} else {
			const editor = vscode.window.activeTextEditor;
			filePathP = editor.document.fileName;
			filePath = vscode.workspace.asRelativePath(editor.document.fileName);
		}
		console.log('FilePath:' + filePath);
		return [filePath, filePathP];
	}

	let rsyncid = null;
	let rsynctime = null;

	const rsynclog = function (input) {
		let run = function () {
			rsynctime = setInterval(function () {
				socketServer.sendData(input, JSON.stringify({
					'type': 'rsynclog'
				}), (result) => {
					result = JSON.parse(result);
					if (logwebview != null) {
						logwebview.webview.html = result['data'].replace(/\n/g, '<br/>');
					}
				});
			}, 1000);
			vscode.window.showInformationMessage('Rsync Log Start!');
			rsyncid = input;
		};
		if (!rsynctime) {
			run();
		} else {
			clearInterval(rsynctime);
			rsynctime = null;
			if (rsyncid != input) {
				run();
			} else {
				vscode.window.showInformationMessage('Rsync Log Stop!');
				rsyncid = null;
			}
		}
	}

	let defaultValue;

	context.subscriptions.push(
		vscode.commands.registerCommand('command_pushfile', async (resource) => {
			vscode.window.showInputBox({ prompt: 'PushFile - Enter JsHook server IP address', value: defaultValue }).then(async (input) => {
				if (input) {
					const fileinfo = await getfile(resource);
					defaultValue = input
					socketServer.sendData(input, JSON.stringify({
						'type': 'pushfile',
						'path': fileinfo[0],
						'name': fileinfo[1],
						'data': fileinfo[2]
					}), (result) => {
						vscode.window.showInformationMessage('Push Script Success!');
					});
				}
			});
		}),
		vscode.commands.registerCommand('command_pullfile', async (resource) => {
			vscode.window.showInputBox({ prompt: 'PullFile - Enter JsHook server IP address', value: defaultValue }).then(async (input) => {
				if (input) {
					const fileinfo = await getfilepath(resource);
					defaultValue = input
					socketServer.sendData(input, JSON.stringify({
						'type': 'pullfile',
						'path': fileinfo[0]
					}), (result) => {
						result = JSON.parse(result);
						vscode.workspace.fs.writeFile(vscode.Uri.file(fileinfo[1]), Buffer.from(result['data'], 'utf-8'));
						vscode.window.showInformationMessage('Pull Script Success!');
					});
				}
			});
		}),
		vscode.commands.registerCommand('command_clearlog', async (resource) => {
			vscode.window.showInputBox({ prompt: 'ClearLog - Enter JsHook server IP address', value: defaultValue }).then(async (input) => {
				if (input) {
					defaultValue = input
					socketServer.sendData(input, JSON.stringify({
						'type': 'clearlog'
					}), (result) => {
						vscode.window.showInformationMessage('Clear Log Success!');
						if (logwebview != null) {
							logwebview.webview.html = '';
						}
					});
				}
			});
		}),
		vscode.commands.registerCommand('command_rsynclog', async (resource) => {
			vscode.window.showInputBox({ prompt: 'RsyncLog - Enter JsHook server IP address', value: defaultValue }).then(async (input) => {
				if (input) {
					defaultValue = input
					rsynclog(input);
				}
			});
		})
	)
}

async function deactivate() { }

module.exports = {
	activate,
	deactivate
}
