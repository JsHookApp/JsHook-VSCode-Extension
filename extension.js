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

	const socketServer = {
		socket: null,
		sendData: (input, data, fun = null) => {
			this.socket = net.createConnection(9358, input);
			this.socket.on('connect', () => {
				console.log('Connected to server.');
				this.socket.write(data + "\n")
			});
			this.socket.on('data', (data) => {
				console.log(`Received data: ${data}`);
				this.socket.destroy();
				fun && fun(data);
			});
			this.socket.on('error', (error) => {
				vscode.window.showErrorMessage(`Socket error: ${error}`);
			});
			this.socket.on('close', () => {
				console.log('Socket closed.');
				this.socket = null;
			});
		}
	};

	const getfile = async (resource) => {
		var fileContent;
		var fileName;
		var filePath;
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
		console.log('FileContent:' + filePath + ':' + fileContent.toString());
		return [filePath, fileName, fileContent.toString()];
	}

	const getfilepath = async (resource) => {
		var filePath;
		var filePathP;
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

	let defaultValue;

	context.subscriptions.push(
		vscode.commands.registerCommand('command_pushfile', async (resource) => {
			vscode.window.showInputBox({ prompt: '输入 JsHook 服务端 IP 地址(Enter JsHook server IP address)', value: defaultValue }).then(async (input) => {
				if (input) {
					const fileinfo = await getfile(resource);
					defaultValue = input
					socketServer.sendData(input, JSON.stringify({
						'type': 'pushfile',
						'path': fileinfo[0],
						'name': fileinfo[1],
						'data': fileinfo[2]
					}));
				}
			});
		}),
		vscode.commands.registerCommand('command_pullfile', async (resource) => {
			vscode.window.showInputBox({ prompt: '输入 JsHook 服务端 IP 地址(Enter JsHook server IP address)', value: defaultValue }).then(async (input) => {
				if (input) {
					const fileinfo = await getfilepath(resource);
					defaultValue = input
					socketServer.sendData(input, JSON.stringify({
						'type': 'pullfile',
						'path': fileinfo[0]
					}), (result) => {
						result = result.toString();
						result = JSON.parse(result);
						vscode.workspace.fs.writeFile(vscode.Uri.file(fileinfo[1]), Buffer.from(result['data'], 'utf-8'));
					});
				}
			});
		})
	)

	// vscode.window.showInformationMessage('Welcome JsHook-VSCode-Extension!');
}

async function deactivate() { }

module.exports = {
	activate,
	deactivate
}
