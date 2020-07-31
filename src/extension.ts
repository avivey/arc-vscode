import * as vscode from 'vscode';
import * as lint from './arc_lint';

export function activate(context: vscode.ExtensionContext) {
	const collection = vscode.languages.createDiagnosticCollection('arc lint');

	lint.setup();

	function d(disposable: vscode.Disposable) {
		context.subscriptions.push(disposable);
	}

	d(vscode.commands.registerCommand('arc-vscode.clearLint', () => collection.clear()));

	d(vscode.workspace.onDidSaveTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidOpenTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidChangeConfiguration(onChangeConfig));

	if (vscode.window.activeTextEditor) {
		lint.lintFile(vscode.window.activeTextEditor.document, collection);
	}

	d(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			lint.lintFile(editor.document, collection);
		}
	}));

	function onTextDocumentEvent(document: vscode.TextDocument) {
		lint.lintFile(document, collection);
	}

}

export function deactivate() {
	// TODO collection.clear();
}

function onChangeConfig(e: vscode.ConfigurationChangeEvent) {
	if (!e.affectsConfiguration('arc-vscode.lint')) {
		return;
	}
	lint.updateLintSeverityMap();
}
