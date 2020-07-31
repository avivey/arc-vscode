import * as vscode from 'vscode';
import * as lint from './arc_lint';

export function activate(context: vscode.ExtensionContext) {
	const diagnostics = vscode.languages.createDiagnosticCollection('arc lint');

	lint.setup();

	function d(disposable: vscode.Disposable) {
		context.subscriptions.push(disposable);
	}
	d(diagnostics);

	d(vscode.commands.registerCommand('arc-vscode.clearLint', () => diagnostics.clear()));

	d(vscode.workspace.onDidSaveTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidOpenTextDocument(onTextDocumentEvent));
	d(vscode.workspace.onDidChangeConfiguration(onChangeConfig));

	if (vscode.window.activeTextEditor) {
		lint.lintFile(vscode.window.activeTextEditor.document, diagnostics);
	}

	d(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			lint.lintFile(editor.document, diagnostics);
		}
	}));

	d(vscode.workspace.onDidCloseTextDocument(document => diagnostics.delete(document.uri)));

	function onTextDocumentEvent(document: vscode.TextDocument) {
		lint.lintFile(document, diagnostics);
	}

}

export function deactivate() { }

function onChangeConfig(e: vscode.ConfigurationChangeEvent) {
	if (!e.affectsConfiguration('arc-vscode.lint')) {
		return;
	}
	lint.updateLintSeverityMap();
}
